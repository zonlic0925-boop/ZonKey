"""round-25：证件照换底色手动裁剪参数（crop_x/y/w/h）回归。

前端 CropStage 输出原图像素裁剪框，后端在自动人像定位前先按该区域预裁剪。
断言：
1. 有效 crop 区域 → 产物按一寸 25×35mm@300DPI（295×413）输出；
2. 裁剪区过小（<50×50）→ 400；
3. 不传 crop（默认 -1）→ 旧行为不回归（自动人像定位照常）。
"""

import io

import numpy as np
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image


def _synth_photo(w=640, h=800) -> bytes:
    """蓝底 + 中央肤色人像块 + 右上角深色污渍（合成证件照夹具）。"""
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :] = (28, 95, 140)          # 蓝底
    arr[160:580, 180:460] = (242, 201, 160)  # 人像
    arr[30:90, 560:620] = (10, 10, 10)  # 右上污渍（需裁掉的内容）
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def client():
    # sub-router 直接 TestClient 会缺 FastAPI app 的 async exit stack 中间件，
    # 必须挂到 FastAPI 实例（同 server_bridge.py 的组装方式）
    from fastapi import FastAPI

    from backend_toolbox_tools import router

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def _post(client, data: bytes, **form) -> dict:
    files = {"file": ("id.png", data, "image/png")}
    res = client.post("/api/toolbox/id-photo", data=form, files=files)
    return {"status": res.status_code, "bytes": res.content}


def test_id_photo_manual_crop_removes_corner_stain(client):
    """crop 区域框住人像（污渍在框外）→ 生成成功且尺寸标准。"""
    data = _synth_photo()
    # 人像块 180..460 x 160..580，crop 框住 (150,130)-(480,610)
    out = _post(client, data, bg_color="#438EDB", size_preset="one-inch",
                crop_x=150, crop_y=130, crop_w=330, crop_h=480)
    assert out["status"] == 200, out["bytes"][:200]
    img = Image.open(io.BytesIO(out["bytes"]))
    assert img.size == (295, 413)  # 25×35mm @ 300DPI


def test_id_photo_manual_crop_too_small_rejected(client):
    """小于 50×50 的裁剪框 → 400（防呆，不静默产出废图）。"""
    data = _synth_photo()
    out = _post(client, data, crop_x=10, crop_y=10, crop_w=20, crop_h=20)
    assert out["status"] == 400


def test_id_photo_crop_region_without_person_rejected(client):
    """crop 框住纯背景（无人像）→ 422（诚实失败，不硬出全底色图）。
    注意区域必须真无前景：夹具右上污渍块会被色距通道当"人像"正常产出。"""
    data = _synth_photo()
    # 右下纯蓝区（人像止于 y<580，污渍止于 x<620,y<90）：x 480..640, y 600..800
    out = _post(client, data, crop_x=480, crop_y=600, crop_w=160, crop_h=200)
    assert out["status"] == 422


def test_id_photo_no_crop_still_works(client):
    """不传 crop 参数（Form 默认 -1）→ 全自动人像定位照常（旧路径不回归）。"""
    data = _synth_photo()
    out = _post(client, data, bg_color="#FFFFFF", size_preset="two-inch")
    assert out["status"] == 200, out["bytes"][:200]
    img = Image.open(io.BytesIO(out["bytes"]))
    assert img.size == (413, 579)  # 35×49mm @ 300DPI


def test_id_photo_crop_clamps_out_of_bounds(client):
    """crop 越界（超图宽/负坐标）→ 按图边界收束而不是 500。"""
    data = _synth_photo()
    out = _post(client, data, crop_x=-50, crop_y=-50, crop_w=99999, crop_h=99999)
    assert out["status"] in (200, 422)  # 收束为全图后正常人像定位；任何情况都不得 500
