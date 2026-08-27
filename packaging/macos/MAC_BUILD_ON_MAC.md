# ZonScale — 在 Mac 上封装 .app（构建包说明）

> 本文件随 **Mac 构建包** 一起分发。在 Mac 上解压后，按下列步骤操作即可。

## 一、Mac 环境要求

| 项 | 要求 |
|---|---|
| 系统 | macOS 11.0 或更高 |
| 芯片 | Apple Silicon (M1/M2/M3) 或 Intel 均可（在哪种 Mac 上构建，产物就适配哪种） |
| Python | **3.11.x**（[python.org](https://www.python.org/downloads/) 或 `brew install python@3.11`） |
| Node.js | **可选** — 构建包内已含预编译 `dist_web/`，一般不必安装 |

## 二、解压后目录应包含

```
ZonScale-mac-build-kit/
├── MAC_BUILD_ON_MAC.md      ← 本说明（根目录副本）
├── build_zonscale_mac.sh    ← 一键构建入口
├── requirements.txt
├── desktop_app.py
├── server_bridge.py
├── core/                    ← 脱敏引擎
├── rules/                   ← 词表（可按需修改后再打包）
├── dist_web/                ← 已编译前端（必需）
├── packaging/macos/         ← PyInstaller spec 与脚本
└── scripts/
    ├── package_mac_app.py
    └── release_acceptance.py
```

## 三、构建命令（复制粘贴）

在 **终端 (Terminal)** 中：

```bash
# 1. 进入解压后的目录
cd ~/Downloads/ZonScale-mac-build-kit    # 按实际路径修改

# 2. 创建虚拟环境（推荐）
python3.11 -m venv .venv
source .venv/bin/activate

# 3. 安装 Python 依赖
python -m pip install --upgrade pip
pip install -r requirements.txt

# 4. 一键构建 .app + ZIP
chmod +x build_zonscale_mac.sh
./build_zonscale_mac.sh
```

构建约 **5～15 分钟**（取决于 Mac 性能）。

## 四、构建产物

| 路径 | 说明 |
|---|---|
| `dist/ZonScale.app` | 双击运行 |
| `dist_release/ZonScale_macOS_<arch>_<日期>.zip` | 可分发给其他 Mac 用户 |
| `dist_release/*.dmg` | 若 `hdiutil` 成功则额外生成 |

用户数据目录：`~/Library/Application Support/ZonScale/`

## 五、首次打开（给其他用户）

右键 **ZonScale.app → 打开 → 打开**（未 Apple 公证时系统会拦截）

## 六、故障排查

**构建失败 — 缺模块**

```bash
pip install -r requirements.txt
pip install pyinstaller pyobjc-core pyobjc-framework-Cocoa pyobjc-framework-WebKit
./build_zonscale_mac.sh
```

**双击 .app 无窗口**

```bash
dist/ZonScale.app/Contents/MacOS/ZonScale
# 或浏览器打开 http://127.0.0.1:8765
cat ~/Library/Application\ Support/ZonScale/startup_error.log
```

**缺少 dist_web**

```bash
# 仅当包内没有 dist_web/index.html 时需要 Node.js 18+
cd frontend && npm ci && npm run build && cd ..
./build_zonscale_mac.sh
```

## 七、可选：重新编译前端

若你修改了 `frontend/` 源码：

```bash
cd frontend
npm ci
npm run build
cd ..
./build_zonscale_mac.sh
```

---

by zonlic · ZonScale
