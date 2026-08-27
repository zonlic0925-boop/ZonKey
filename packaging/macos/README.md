# ZonScale macOS 打包指南

## 可行性说明

| 项 | 结论 |
|---|---|
| 能否做成 Mac 可用软件 | **可以**，与 Windows 版同一套 `desktop_app.py` + PyInstaller + pywebview |
| 能否在 Windows 上直接打出 `.app` | **不能**，必须在 **macOS（Intel 或 Apple Silicon）** 上构建 |
| 是否需要联网 | **不需要**，与 Windows 版一样本地离线运行 |

## 环境要求

- macOS 11.0 或更高
- Python 3.11.x（建议与 Windows 开发环境同版本）
- Node.js 18+（构建前端 `dist_web`）
- 项目依赖已安装：`pip install -r requirements.txt`（或当前 venv 已装齐 PyMuPDF / onnxruntime / pywebview 等）

## 一键构建

在项目根目录执行：

```bash
chmod +x build_zonscale_mac.sh
./build_zonscale_mac.sh
```

脚本会自动：

1. 若缺少 `dist_web/` → 运行 `cd frontend && npm run build`
2. 检查发布版词表（无 Fisher/Emerson 等出厂企业词）
3. PyInstaller 生成 `dist/ZonScale.app`
4. 运行 `scripts/release_acceptance.py --app-dir dist/ZonScale.app`
5. 打包 ZIP → `dist_release/ZonScale_macOS_<arch>_<日期>.zip`

## 产物说明

| 路径 | 说明 |
|---|---|
| `dist/ZonScale.app` | 可直接双击运行的 Mac 应用 |
| `dist_release/ZonScale_macOS_*.zip` | 分发给用户的压缩包（含 README） |

**用户数据目录（Mac 冻结版）**：`~/Library/Application Support/ZonScale/`  
（规则、输出、临时文件；避免写入 `.app` 包内导致权限失败）

## 首次打开（Gatekeeper）

未 Apple 公证的 `.app` 可能提示「无法验证开发者」：

1. **右键 ZonScale.app → 打开 → 打开**；或  
2. 系统设置 → 隐私与安全性 → **仍要打开**

## 可选：签名与公证（对外分发）

需 Apple Developer 账号（$99/年）：

```bash
# 1. 签名（替换 YOUR_TEAM_ID）
codesign --deep --force --options runtime \
  --entitlements packaging/macos/config/entitlements.plist \
  --sign "Developer ID Application: YOUR_NAME (TEAM_ID)" \
  dist/ZonScale.app

# 2. 公证 + 装订（notarytool，需 App Store Connect API Key）
```

未签名版本适合**内部使用**或**小范围分发**（配合 README 说明右键打开）。

## 常见问题

### 构建失败：找不到 onnxruntime / cv2

在 Mac 的 venv 中重新安装与 Windows 相同的依赖后再构建。

### 双击无窗口

1. 终端运行：`dist/ZonScale.app/Contents/MacOS/ZonScale` 查看报错  
2. 或浏览器访问：http://127.0.0.1:8765  
3. 查看日志：`~/Library/Application Support/ZonScale/startup_error.log`

### 在 Windows 开发机上怎么办

- 借用 Mac 笔记本 / Mac mini 构建；或  
- 使用 GitHub Actions `macos-latest` CI 自动构建（需自行配置 workflow）

## 与 Windows 版差异

| | Windows | macOS |
|---|---|---|
| 打包脚本 | `build_zonscale_exe.bat` | `build_zonscale_mac.sh` |
| 产物 | `dist/ZonScale/ZonScale.exe` | `dist/ZonScale.app` |
| 可写数据 | exe 同级目录 | `~/Library/Application Support/ZonScale/` |
| 文件夹选择 | Win32 原生对话框 | tkinter 对话框 |
