# Agents Handoff（交接文本）

> 可直接复制本文件给下一位 agent。更新每次会话结束/轮次切换时。
> 配套进度细节见 [PROJECT_STATUS.md](PROJECT_STATUS.md)；ToolKnit 整合明细见 [TOOLKNIT_INTEGRATION_PLAN.md](TOOLKNIT_INTEGRATION_PLAN.md)。

## 当前目标与已确认边界

- 项目：**ZonScale**——本地离线脱敏工作台（公开发布版），读入 PDF 工程图纸/公文 PDF/Word，在框线约束内抹除用户自配敏感词/Logo/保密标记，输出 `原名_desensitized` 副本，不改原始文件。
- 当前状态：**ToolKnit 60 项工具整合已完成并收尾（2026-08-29）**。
  - 8 大中心全部挂载 60 项工具：智能脱敏（原生 5 项）+ PDF 工坊 + PPT 工坊 + 图像工坊 + 音视频中心 + 文本工坊 + 计算开发 + 系统硬件（经 FastAPI `backend_system_tools.py`）。
  - 46 项 ready / 14 项 planned（占位"即将上线"，不虚报）；阶段提交 Phase 1-8 见 TOOLKNIT 计划第五节。
  - 收尾轮完成：孤儿文件清理（旧双 Header、孤儿 PdfStudioView、rcedit 工具与测试 ico、_tmp 残留）、文档状态登记、三道验证全绿。
- 已确认技术路线（不得更改）：
  - **脱敏引擎宪法**：输入只接受 PDF（DXF/DWG 已否定）；禁联网/云脱敏、禁深度学习 inpainting、禁全图盲搜；FALLBACK 无框归位不得自动执行；图片内容验证（crop OCR → `match_image` 判别 token）未命中强制降级待人工防误抹；敏感词只走 `rules/sensitive_terms.txt` 外部词表，代码零硬编码。
  - **发布版红线**：`rules/` 仅通用保密词；禁止内置 Fisher/Emerson/TopWorx/MKS 厂商规则与 Logo（公司内建版在 `Desktop/experiment/Desensitization`，两仓库 UI/打包/规则真源完全分离）。
  - **前端栈**：React + TypeScript + Tailwind（Memphis 风格）+ Framer Motion；纯前端引擎在 `frontend/src/lib/toolknit/`（12 个 core 模块）；系统硬件走 FastAPI 桥（`server_bridge.py` + `backend_system_tools.py`）。

## 收尾轮验收证据（2026-08-29，实际执行）

- `python -m pytest -q` → **95 passed in 173.51s**
- `cd frontend && npm run build` → **成功**（2599 modules；仅 chunk >500kB 体积提示，无错误）
- `python scripts/release_acceptance.py` → **全部通过**（词表 9 条通用词零厂商泄漏；exe 随包规则同检；合成样本脱敏残留为零、受保护内容保留）

## 历史债务与实机验收记录

D1-D8 债务、T1-T4 设计取舍、F1/F2 功能需求、D3/D4/D8 修复实施记录、31 样本回归基线——**全部保留在 [PROJECT_STATUS.md](PROJECT_STATUS.md)**，此处不重复。其中仍开放项：D1（OCR 模型上限，人工兜底）、D2（1 框阈值内待目检）、D5（2 处图片验证未命中待人工/白名单决策）、D6/D7/D8（待用户实机复验一键模式与行级收缩新行为）。

## 下一步（后续批次，用户 2026-08-29 指定优先级）

1. **PDF 批次**：转图片、加密、解密、扫描增强、页面编辑器（`pdfcenter/` 内扩展，引擎参考 `lib/toolknit/pdfCore.ts`）；
2. **音视频批次**：视频转码、视频转 GIF（`mediacenter/`）；
3. **调性检测**：口径待确认（BPM 检测已 ready；若指音乐调性 key 分析为扩展项）；
4. **色彩批次**：色彩空间色域对比（`imagecenter/`）。
5. 其余 planned：PPT 转 PDF/转图片/AI 大纲/AI 草稿、离线转写、打字测速。

每批次完成标准：`npm run build` 零错误 + 工具实机可走通 + `availability` 从 `planned` 改 `ready`（`frontend/src/lib/navigation.tsx`）。

## 命令速查

```powershell
# 前端构建（dist_web）
cd frontend && npm run build
# 后端测试
python -m pytest -q
# 发布门禁
python scripts/release_acceptance.py
# 开发（浏览器 / pywebview 壳）
python launch_app.py
python desktop_app.py
# Windows EXE
build_zonscale_exe.bat
```

## 禁止触碰（宪法红线）

- 恢复 FALLBACK 自动执行 / 敏感词硬编码 / 增加 DXF/DWG、联网、深度学习 inpainting、全图盲搜通道。
- 修改 AGENTS.md 宪法、核心 API 契约、词表合同语义、输出命名规则（需用户确认）。
- 把任何厂商词/Logo 带入发布版 `rules/` 或代码；客户原始图纸进文档/日志/交付物（测试样本除外）。
