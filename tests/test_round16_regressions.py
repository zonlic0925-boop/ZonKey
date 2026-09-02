"""Round-16 回归防线：图标 alpha 契约 + 另存对话框文件类型/COM 初始化。

- ICO 帧 alpha 必须非 0 即 255 且四角透明（用户反复投诉的「图标白底」，
  真根因是半透明 overlay 用 Image.composite 整像素替换——见
  scripts/generate_zonkey_icon.py round-16 注释）。
- _pick_save_path_win 必须 CoInitialize + 挂 owner 窗口（壳内另存对话框
  静默失败的根因），文件类型按扩展名映射，不再一律默认 PDF 过滤器。
"""
import io
import struct
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


# ---------------- 图标 alpha 契约 ----------------

def _ico_frames(path: Path):
    data = path.read_bytes()
    count = struct.unpack_from("<H", data, 4)[0]
    for i in range(count):
        entry = data[6 + 16 * i : 6 + 16 * (i + 1)]
        length = struct.unpack_from("<I", entry, 8)[0]
        offset = struct.unpack_from("<I", entry, 12)[0]
        yield data[offset : offset + length]


def _decode_dib_or_png(blob: bytes):
    from PIL import Image

    if blob[:8] == b"\x89PNG\r\n\x1a\n":
        return Image.open(io.BytesIO(blob)).convert("RGBA")
    bpp = struct.unpack_from("<H", blob, 14)[0]
    width = struct.unpack_from("<i", blob, 4)[0]
    dib_h = struct.unpack_from("<i", blob, 8)[0] // 2
    pitch = ((width * bpp + 31) // 32) * 4
    xor = blob[40 : 40 + pitch * dib_h]
    px = bytearray(pitch * dib_h)
    for row in range(dib_h):  # DIB 底向上 → 顶向下
        src = (dib_h - 1 - row) * pitch
        px[row * pitch : (row + 1) * pitch] = xor[src : src + pitch]
    return Image.frombytes("RGBA", (width, dib_h), bytes(px), "raw", "BGRA")


@pytest.mark.parametrize("size", [256, 128, 64, 48, 32, 16])
def test_ico_frame_alpha_contract(size):
    """每尺寸帧：alpha ∈ {0,255}，四角全透明，冠形存在（中心不透明）。"""
    from PIL import Image

    ico = ROOT / "assets" / "zonkey.ico"
    if not ico.is_file():
        pytest.skip("assets/zonkey.ico 未生成（先跑 generate_zonkey_icon.py）")
    frames = list(_ico_frames(ico))
    assert len(frames) == 6, "ICO 应含 6 尺寸帧"
    target = None
    for blob in frames:
        im = _decode_dib_or_png(blob)
        if im.width == size:
            target = im
            break
    assert target is not None, f"缺少 {size}px 帧"
    alphas = {px[3] for px in target.getdata()}
    assert alphas <= {0, 255}, f"{size}px 存在半透明像素（白底/发黑回退）: {sorted(alphas - {0, 255})[:8]}"
    corners = [target.getpixel(p)[3] for p in [(0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)]]
    assert all(a == 0 for a in corners), f"{size}px 四角必须透明: {corners}"
    assert target.getpixel((size // 2, size // 2))[3] == 255, f"{size}px 中心皇冠应不透明"


# ---------------- 另存对话框参数 ----------------

def test_pick_save_path_filetypes_by_extension(monkeypatch):
    import core.native_dialog as nd

    captured = {}

    def fake_win(default_name, initial_dir, filetypes):
        captured["name"] = default_name
        captured["filetypes"] = filetypes
        return None

    monkeypatch.setattr(nd, "_pick_save_path_win", fake_win)
    assert nd.pick_save_path("a_crop.png") is None
    assert captured["filetypes"][0][0] != "PDF 文档", "PNG 不得默认 PDF 过滤器"
    assert any("*.png" in pattern for _, pattern in captured["filetypes"])

    nd.pick_save_path("b.pdf")
    assert any("*.pdf" in pattern for _, pattern in captured["filetypes"])

    nd.pick_save_path("c.zip")
    assert any("*.zip" in pattern for _, pattern in captured["filetypes"])

    nd.pick_save_path("d.unknownext")
    assert any("*.*" in pattern for _, pattern in captured["filetypes"])


def test_pick_save_path_win_initializes_com_and_owner(monkeypatch):
    """壳内 GetSaveFileNameW 静默失败根因防线：必须先 CoInitialize、挂前台 owner。"""
    import ctypes
    import core.native_dialog as nd

    calls = {"coinit": 0, "owner": 0, "getsave": 0}
    counters = {"co": 0}

    class FakeOle:
        def CoInitialize(self, *_a):
            counters["co"] += 1

        def CoUninitialize(self):
            assert counters["co"] > 0, "CoUninitialize 必须配对"

    class FakeUser:
        def GetForegroundWindow(self):
            calls["owner"] += 1
            return 12345

    class FakeComdlg:
        def GetSaveFileNameW(self, byref_ofn):
            calls["getsave"] += 1
            assert calls["owner"] >= 1, "owner 必须在调用前取前台窗口"
            assert counters["co"] == 1, "必须先 CoInitialize"
            ofn = byref_ofn._obj
            assert ofn.hwndOwner == 12345
            return 0  # 模拟用户取消

    # native_dialog 在函数体内调 ctypes.OleDLL/WinDLL——替换全局 ctypes 工厂
    class _Shim:
        @staticmethod
        def OleDLL(name):
            return FakeOle()

        @staticmethod
        def WinDLL(name):
            return FakeUser() if name == "user32" else FakeComdlg()

    monkeypatch.setattr(nd.ctypes, "OleDLL", _Shim.OleDLL, raising=False)
    monkeypatch.setattr(nd.ctypes, "WinDLL", _Shim.WinDLL, raising=False)

    assert nd._pick_save_path_win("x.png", None, [("图片", "*.png"), ("所有文件", "*.*")]) is None
    assert calls["getsave"] == 1
