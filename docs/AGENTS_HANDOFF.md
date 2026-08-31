# Agents Handoff（交接文本）

> 可直接复制本文件给下一位 agent。更新每次会话结束/轮次切换时。本版更新于 2026-08-31（收尾轮：P3/P4 全绿 + EXE + Pages 部署 + git 收尾）。
> 配套进度细节见 [PROJECT_STATUS.md](PROJECT_STATUS.md)；ToolKnit 整合明细见 [TOOLKNIT_INTEGRATION_PLAN.md](TOOLKNIT_INTEGRATION_PLAN.md)；iLovePDF 对齐计划见 [ILOVEPDF_INTEGRATION_PLAN.md](ILOVEPDF_INTEGRATION_PLAN.md)。

## 〇、2026-08-31 收尾轮（P3 安全工具 + P4 收尾 + 打包/部署，已提交）

- **工作树干净**：`git status` 无未提交变更；master 最新提交 `e80eb98`（20:36，6 笔提交一次收尾）。文档（本文件 + PROJECT_STATUS.md）在收尾轮内最后更新并另行提交，若接手时工作树出现这两文件变更即属正常。
- **P3 安全工具全链路（已提交 `33a91ea` 后端 / `838776d` 前端 / `67ff56c` 测试）**：
  - 权限保护 Protect PDF：pikepdf 全量加密（用户权限位 + 口令），`/api/security/protect`；
  - 证书签名 Cert Sign：pyHanko 真 PAdES 签名（`/api/security/pades-sign`），自签证书/私钥上传 UI（PEM）已修好，`/api/security/verify` 验签；
  - 同源 API 路径修正、mainboard/bios 渲染、cleanup 加载态、i18n 三语补键；
  - 测试 `tests/test_p3_security_tools.py`（143 行：protect 权限位 + pades 真签真验 + verify 断言）+ `tests/test_p4_gates.py`（42 行：cleanup 端点结构 + convert capability 键）。
- **P4 收尾（已提交 `7fc07e0` / `e33aa2e`）**：PDF 中心导航分组（组织/转换/编辑/安全）+ 工具首页宫格；系统清理端点 `/api/system/cleanup/status`（监控 output + temp_bridge_files，门禁 `cleanup_endpoints` 断言）。
- **桌面复测完成**：`temp_ui_test/full_feature_test*.mjs`（MODE=mobile|desktop）覆盖 8 中心 76 工具 + 导航 + 隐私弹窗 + 横向溢出，产物 `temp_ui_test/shots_full/`；本轮含最后一笔 UI 微调（CanvasViewport 移动端把手/按钮区 `zs-touch-target-mobile` 等）。
- **Phase 9 完成（EXE 重打包）**：`dist_release/ZonScale_Windows_x64_20260831.zip`（20:29，~280MB，3776 条目）。**已验证内嵌前端 = 当前构建**：`_internal/dist_web/assets/index-BP5sWohB.js` 与根 `dist_web/` 及线上 Pages 资产哈希完全一致（含最后一笔提交的特征串）。
- **Phase 10 完成（Pages 部署）**：生产 `zonscale.pages.dev` 已部署（wrangler 直传，非 Git 集成），线上资产 = 本地 `dist_web/`；`curl` 200 + 0.30s。
- **三道验证全绿（2026-08-31 复核）**：
  - `pytest -q --ignore=tests/test_native_dialog.py` → **127 passed**（33.8s，唯一告警为 Starlette httpx 弃用提示，可忽略）；
  - `python scripts/release_acceptance.py` → 全部通过（exe_exists / synthetic_pipeline 零残留 / no_agpl_components / cleanup_endpoints / convert_capability_gate / generic_terms_in_rules）；
  - 线上 URL `https://zonscale.pages.dev` → HTTP 200。
- **仍开放（接手顺序建议）**：
  1. **31 样本回归**（`Testing Drawings\` 目录本机不存在，`scripts/regression_acceptance.py` 未跑）——样本到位后必跑作最终确认；
  2. `temp_ui_test/`（含 shots_full/ 截图、合成样本、full_feature_test*.mjs）为已提交的测试资产目录，如需瘦身/清理请确认后处理；
  3. 后续功能迭代（若有）按第四节 UI 偏好与第三节技术路线执行，不得回退。

## 2026-08-30 第二轮（P2 端点补齐 + ConvertView 接线，未提交）

- **P2 四端点全绿**（backend_convert_tools.py，均含合成样本端到端测试）：
  - `compress-deep`：pypdfium2 栅格化（72–200dpi）+ JPEG 质量档（30–95）重编码 + reportlab 画布回写，job 模式，响应含压缩比；诚实标注栅格化后无文本层；
  - `html-to-pdf`：同步端点，HTML/Markdown 子集 → reportlab platypus（img 忽略记提示、零联网）；CJK 字体注册链 msyh.ttc → simhei → STSong-Light CID；
  - `ocr-export`：复用 `core.detector.ocr_channel` RapidOCR，TXT / 夹心 PDF（`setTextRenderMode(3)` 隐形文字层原位叠加，测试用 pdfium 重新抽取验证可搜索）；rapidocr 缺失时 capability=false 前端拦截；
  - office 兜底链：COM 失败 → Word 走 mammoth→HTML→reportlab、Excel 走 openpyxl→HTML→reportlab，job note+warnings 诚实标注降级，双失败报错明示两条错误。
- **前端 ConvertView 上线**：`pdfcenter/ConvertView.tsx` 单组件 8 工具（6 个 job 轮询 + repair/html-to-pdf 同步），CapabilityGate（后端离线/OCR 缺失）、进度条 + stage、压缩比与引擎 note 展示；api.ts 补全类型与 startConvertJob/pollConvertJob/convertHtmlToPdf/convertRepair；navigation.tsx PDF 工坊 **17 项全 ready**；i18n `convert.*` 三语命名空间齐。
- **验证证据**：`tests/test_convert_tools.py` 22 用例（新增 9）；全量 `pytest -q --ignore=tests/test_native_dialog.py` → **121 passed**（原 112 + 新 9）；`npm run build` 成功（21.6s）；Cloudflare Pages 已重新部署（zonscale.pages.dev）——线上仅纯前端能力，转换工具显示后端离线属预期边界。
- **尚未做（接手顺序建议）**：
  1. 浏览器级 UI 实测轮（已跑通，跳过单页拆分与下载断言异常）：P0/P1 的 14 个 PDF 工具 + 新转换 8 工具 + 脱敏全链路（Phase M 后首确保真）一起补；
  2. 31 样本回归（`Testing Drawings\` 样本到位后跑 `scripts/regression_acceptance.py`）；
  3. **工作树大量未提交变更**（P2 两轮 + Phase M 全部，含 EXE 重打包产物路径），建议用户过目后择机分批提交；
  4. 之后才是 P3（编辑/表单/签名）与 P4 收尾（导航重组、清理端点、门禁增列）。

## 2026-08-30 下午（Phase M：PyMuPDF 退出迁移，未提交）

- **AGPL 清零完成，发布门禁新增 `no_agpl_components` 断言全绿，EXE 已重打包**（PyInstaller 重建 + `dist_release/ZonScale_Windows_x64_20260830.zip`）。PyMuPDF 已从 requirements.txt 除名并卸载，全仓 `import fitz` 归零（含 11 个测试文件、3 个脚本、temp_ui_test/make_samples.py）。
- **新读取层 `core/pdfio.py`**：渲染=pypdfium2（Apache-2.0）、文本/矢量/图片抽取=pdfplumber（MIT）、AcroForm 控件值读取=pikepdf。坐标合同 = fitz 兼容「显示空间」（原点左上、y 向下、随 /Rotate）；pdfplumber 坐标本就是显示空间（实测验证），渲染 clip 用 pypdfium2 四边裁剪量 `(left, bottom, right, top)` 换算——**pypdfium2 的 crop 是「四边裁多少」不是坐标矩形**，这是踩过的坑。
- **新写入引擎 `core/redact/pikepdf_engine.py`**（等价 MuPDF apply_redactions 语义）：
  - 字形级真删除：内容流走查（CTM/文本状态/Tm-Td-TJ 全跟踪）+ 字体宽度（pikepdf /Widths、/W 数组、标准 14 字体走 reportlab AFM 表）；部分删除用 TJ 补偿量保持后续字形原位；
  - 图像像素化：区域置边框带主色（CCITT/ImageMask/DCT/Flate 均支持，SMask 同步置不透明），整图近全覆盖时整体置背景（对齐 T2）；
  - 线画三模式 keep/touched/covered（对应 graphics=0/2/1）；填充块内容流末尾 `re f`；qpdf 保存只写可达对象，敏感值随引用消亡；
  - 关键坑：**pikepdf 对象上 `hasattr(s,'as_bytes')` 会触发属性→字典键回退抛 ValueError**（不能用于类型探测，用 isinstance）；矩阵级联必须按 PDF 规范 4.2.3。
- **迁移清单**：vector_channel / ocr_channel / image_verify / seal_detector / logo_matcher / box_finder / pipeline / doc_pdf pipeline / redact executor / image_merge（reportlab）/ server_bridge 预览扫描 / backend_ppt_tools 渲染（pypdfium2）。`page` 参数从 `fitz.Page` 换成 `core.pdfio.PdfPageView`。
- **测试基建**：`tests/pdf_helpers.py`（reportlab 合成样本 + pdfplumber/pdfium 断言，坐标合同=显示空间）。
- **测试证据**：全量 `pytest -q --ignore=tests/test_native_dialog.py` → **112 passed**（与迁移前同数量，PyMuPDF 已卸载环境下跑）；`release_acceptance.py` → 全部通过（含 AGPL 断言）；合成端到端：A3 图纸 4 命中/2 自动/3 待人工（与 2026-08-29 fitz 实测同构）、公文 PII 8 类全净正文保留（hits 12 vs 旧 11，印章/去重口径差）。
- **诚实登记（行为微差）**：D8 紧行距用例（基线差 18pt）从「放弃收缩」变为「精确收缩+相邻行零污染」——pdfminer span（12pt 高）比 fitz span（~16.5pt）紧，3.5pt 容差带判定前移；字形级删除按字形包围盒相交判定，相邻行净空 ~3.9pt 实测安全，测试改为直接断言安全属性（敏感行抹净 + DWG.NO 原样）。引擎限制：垂直书写（WMode 1）按水平度量、Inline image 不像素化、CropBox≠MediaBox 按 MediaBox。
- **尚未做（接手顺序建议）**：
  1. P2 端点补齐：`compress-deep`、`html-to-pdf`、`ocr-export`、office-to-pdf 的 mammoth→HTML→reportlab 兜底链；
  2. 前端 `ConvertView*` 接线（jobs 轮询 + `deliver.ts` 交付 + CapabilityGate）；
  3. 浏览器级 UI 实测轮：P0/P1 的 14 个 PDF 工具 + 新转换端点 + 脱敏全链路（Phase M 后首确保真）一起补 Playwright；
  4. 之后才是 P3（编辑/表单/签名）与 P4 收尾（导航重组、清理端点、pytest 补齐、门禁增列）。
  - 注意：`scripts/regression_acceptance.py` 的 31 样本基线本轮**未跑**（`Testing Drawings\` 样本目录本机不存在）——下轮拿到样本后必跑一次作最终确认。

## 2026-08-30（P2 转换引擎垂直切片）

- **`backend_convert_tools.py` 上线（`/api/convert`，job 轮询模式）**，server_bridge.py 已挂载：
  - `GET /capability`：引擎版本 + pywin32/Word/Excel COM 导入级探测（与 PPT 工坊同口径；真实可用性转换时确认，缺 Office 任务报错明示）；
  - `POST /pdf-to-word`：pdfplumber 文本行+表格 → python-docx 自研重建（**规避 pdf2docx 的 PyMuPDF 硬依赖**；扫描件无文本层时报错引导 OCR 导出）；
  - `POST /pdf-to-excel`：pdfplumber 表格 → openpyxl（每页一 sheet，表头加粗、数字单元格转数值）；
  - `POST /pdf-to-ppt`：pypdfium2 逐页渲染 → python-pptx 整页贴图（响应标注「视觉版式还原」）；
  - `POST /office-to-pdf`：Word/Excel COM 位置参数调用（wdFormatPDF=17 / xlTypePDF=0，COM 全局锁）；pptx 400 引导走 PPT 工坊；
  - `POST /repair`：pikepdf（qpdf）损坏恢复重写（同步端点，不可修复 422）。
- **诚实标注是接线要求**：PDF→Word 复杂版式保真度下降、PDF→PPT 无可编辑文本、无 Office 时 COM 不可用——前端 ConvertView 须如实展示引擎与局限，禁止静默降级。
- **requirements.txt** 补 P2 宽松许可依赖：pypdfium2 / pikepdf / pdfplumber / python-pptx / openpyxl / mammoth / reportlab；**转换模块零 PyMuPDF 引用**（Phase M 退出计划的第一个干净模块）。
- 测试：新增 `tests/test_convert_tools.py` 13 用例全绿（合成样本端到端，含 Word/Excel COM 真转）；全量 `python -m pytest -q --ignore=tests/test_native_dialog.py` → **112 passed**（native dialog 用例会让无人值守 pytest 挂起，必须 ignore）。
- **尚未做（接手顺序建议）**：
  1. P2 端点补齐：`compress-deep`、`html-to-pdf`、`ocr-export`、office-to-pdf 的 mammoth→HTML→reportlab 兜底链（与 html-to-pdf 共用 HTML 子集解析器）；
  2. 前端 `ConvertView*` 接线（jobs 轮询 + `deliver.ts` 交付 + CapabilityGate）；
  3. 浏览器级 UI 实测轮：P0/P1 的 14 个 PDF 工具 + 新转换端点一起补 Playwright 全流程（此前一直欠着）；
  4. 之后才是 P3（编辑/表单/签名）与 Phase M（PyMuPDF 退出迁移，发布门禁）。

## 2026-08-29 下午（工坊实机修复轮，未提交）

- **PDF 工坊"都不能用"已修复**：根因不是工具代码（Chromium 实测 9/9 通过），而是 pywebview 默认 `ALLOW_DOWNLOADS=False` 在 WebView2 壳内静默取消全部 blob 下载。修复：`desktop_app.py` `_open_pywebview` 设置 `webview.settings['ALLOW_DOWNLOADS'] = True`（放开后弹原生另存为对话框）。**EXE 已重打包才生效**。
- **PPT 工坊 7/7 全部 ready**（新增 4 工具；"AI 大纲/AI 草稿"诚实更名为"大纲生成/草稿生成"——实现是离线模板，不是 AI，不虚标）：
  - 转 PDF / 转长图：新后端 `backend_ppt_tools.py`（`/api/ppt/render`，LibreOffice 优先 → Windows PowerPoint COM 回退），产物走 `output/` + 原生另存为；
  - 大纲生成：离线模板驱动（`pptOutlineCore.ts`）；草稿生成：纯 JSZip 构建合法 OOXML（`pptDraftCore.ts`）；
  - 两个 OOXML 兼容坑已修并登记（theme `fmtScheme` 需恰好 3 组样式；`sldSz type="wide"` 非法枚举值）——后续改 OOXML 生成代码前先读 PROJECT_STATUS.md 该节。
- 实测：PDF 工坊 9/9 + PPT 新 4 工具 Playwright 全通过（脚本 `temp_ui_test/pdf_tools_test.mjs` / `ppt_tools_test.mjs`）；pytest 新增 `tests/test_ppt_tools.py`。
- ToolKnit 接线：**55 ready / 5 planned**（余：视频转码、视频转 GIF、色彩空间对比、离线转写、打字测速）。

## 一、项目一句话定位

**ZonScale**（by zonlic）：本地离线脱敏工作台（公开发布版），读入 PDF 工程图纸/公文 PDF/Word，在框线约束内抹除用户自配敏感词/Logo/保密标记，输出 `原名_desensitized` 副本，不改原始文件。技术栈 React + FastAPI 桥 + pywebview 桌面壳，核心引擎在 `core/`。宪法、红线、兄弟仓库关系见根目录 [AGENTS.md](../AGENTS.md)，**先读它再动手**。

## 二、当前状态（TL;DR）

- **ToolKnit 60 项工具整合已完成并收尾**（收尾提交 `5c80508`，2026-08-29 08:47）。
  - 8 大中心全部挂载 60 项工具：智能脱敏（原生 5 项）+ PDF 工坊 + PPT 工坊 + 图像工坊 + 音视频中心 + 文本工坊 + 计算开发 + 系统硬件（经 FastAPI `backend_system_tools.py`）。
  - **51 ready / 9 planned**（占位"即将上线"，不虚报）；PDF 工坊 9 项已全部 ready（2026-08-29 第二批接入）。
  - 收尾轮：孤儿文件清理（旧双 Header、孤儿 PdfStudioView、rcedit 路线、_tmp 残留）+ 文档登记 + 三道验证全绿。
- **收尾三道验证全绿（2026-08-29 实测）**：
  - `python -m pytest -q` → **95 passed in 173.51s**
  - `cd frontend && npm run build` → **成功**（2599 modules；仅 chunk >500kB 体积提示）
  - `python scripts/release_acceptance.py` → **全部通过**（词表 9 条通用词零厂商泄漏；exe 随包规则同检；合成样本残留为零、保护内容保留）
- **收尾提交后增量（2026-08-29 上午 UI 实测轮，未提交）**：
  - 用合成样本（`temp_ui_test/make_samples.py` 生成 sample.docx / sample_doc.pdf / sample_drawing.pdf）对前端 UI 做了一轮实测；`temp_ui_test/server.log` 显示 FastAPI 桥（/api/status、/api/system/hardware/overview、/api/export/settings）工作正常。
  - `temp_ui_test/` 为**未跟踪目录**（合成测试产物 + 截图），未入 git 也未 gitignore——下个 agent 可复用其合成样本脚本，或确认后清理/加 ignore，勿提交真实客户文件。
- **PDF 工坊第二批（2026-08-29，未提交）**：
  - 5 项 planned → ready：页面编辑器、转图片、加密、解密、扫描增强。
  - 核心：`frontend/src/lib/toolknit/pdfCore.ts` + `pdfRender.ts`（PDF.js + cryptpdf AES-256）；视图 `frontend/src/components/pdfcenter/` 五个新组件。
  - 新依赖：`pdfjs-dist`、`cryptpdf`（`frontend/package.json`）。
  - `cd frontend && npm run build` → **成功**（2607 modules；pdf.worker 单独 chunk；主包 ~1.96MB gzip 658KB）。

## 三、已确认技术路线（不得更改）

- **脱敏引擎宪法**：输入只接受 PDF（DXF/DWG 已否定）；禁联网/云脱敏、禁深度学习 inpainting、禁全图盲搜；FALLBACK 无框归位不得自动执行；图片内容验证（crop OCR → `match_image` 判别 token）未命中强制降级待人工防误抹；敏感词只走 `rules/sensitive_terms.txt` 外部词表，代码零硬编码。
- **发布版红线**：`rules/` 仅通用保密词；禁止内置 Fisher/Emerson/TopWorx/MKS 厂商规则与 Logo（公司内建版在 `Desktop/experiment/Desensitization`，两仓库 UI/打包/规则真源完全分离）。
- **前端栈**：React + TypeScript + Tailwind（Memphis 风格）+ Framer Motion；纯前端工具引擎在 `frontend/src/lib/toolknit/`（12 个 core 模块）；系统硬件走 FastAPI 桥（`server_bridge.py` + `backend_system_tools.py`）。

## 四、用户 UI/工作流硬性偏好（2026-08-29 实测轮核实，动 UI 前必读）

| 偏好 | 状态 | 落点 |
|---|---|---|
| 批量文件先全部载入显示，再从第一张开始识别 | ✅ 上传流已按 preview-first + `preloadPdfPageImages` 实现，改动识别管线时保持此分期 | `components/DrawingView.tsx` |
| 后台识别完成**不得**自动切换/打断用户正在查看的图纸 | ✅ 已实现（仅当无激活文件时才设 activeFileId） | `DrawingView.tsx:174-180` |
| 画布缩放把手小巧精致（~8px 圆点级别），仅选中框显示，命中区保持舒适 | ✅ 已实现（`HANDLE_SIZE=6`，`showHandles` 仅活动框） | `components/CanvasViewport.tsx:30,726-747` |
| EXE/应用图标必须用龙鳞品牌标（标准多尺寸 DIB ICO，防资源管理器回退 Python 图标） | ✅ 已实现（`scripts/generate_zonscale_icon.py` 生成 + PyInstaller 嵌入，rcedit 路线已废弃） | `build_zonscale_exe.bat:52-55,93-94` |

后续任何 UI 改动不得回退以上行为。

## 五、历史债务与开放项

D1-D8 债务、T1-T4 设计取舍、F1/F2 功能需求、修复实施记录、31 样本回归基线——**全部保留在 [PROJECT_STATUS.md](PROJECT_STATUS.md)**，此处不重复。仍开放项：

- D1（OCR 模型上限，人工兜底）、D2（1 框阈值内待目检）、D5（2 处图片验证未命中待人工/白名单决策）；
- D6/D7/D8（待用户实机复验一键模式与行级收缩新行为）。

## 六、下一步

以本文档「〇」节为准（2026-08-31 收尾轮起）：**P3 编辑/表单/签名与 P4 收尾均已完成并提交**，Phase M 与 P2 已完成，EXE 与 Pages 已部署验证。仅剩 31 样本回归（样本到位后跑 `scripts/regression_acceptance.py`）。

每批次完成标准：`npm run build` 零错误 + 工具实机可走通 + `availability` 从 `planned` 改 `ready`（`frontend/src/lib/navigation.tsx`）+ 更新本文档与 PROJECT_STATUS.md。

## 七、命令速查

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

## 八、禁止触碰（宪法红线）

- 恢复 FALLBACK 自动执行 / 敏感词硬编码 / 增加 DXF/DWG、联网、深度学习 inpainting、全图盲搜通道。
- 修改 AGENTS.md 宪法、核心 API 契约、词表合同语义、输出命名规则（需用户确认）。
- 把任何厂商词/Logo 带入发布版 `rules/` 或代码；客户原始图纸进文档/日志/交付物（测试样本除外）。
- 回退第四节任何一条 UI 偏好。
