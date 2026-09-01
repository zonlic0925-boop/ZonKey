# Project Status（项目状态）

> 更新于：2026-09-01（第三轮：用户实测 5 问题修复，EXE+Pages 已交付）。

## 2026-09-01 第三轮进度（用户实测 5 问题修复）

| 项 | 状态 | 说明 |
|---|---|---|
| 引擎条遮挡修复 | ✅ | 桌面行恒定 `pr-[150px]` + 中列 min-w-0 收缩 + 中心导航横向滚动 + 状态条 ellipsis；回归断言右缘 ≤ 窗宽-148 |
| 方框拖动劫持修复 | ✅ | 根因：app-region 逐消息判定，手势滑入 Header 行被接管。修复：`editingId`/`isDrawing` 时 `<html data-canvas-gesture>` → drag 行整体转 no-drag，手势结束恢复。**待壳内真机复验** |
| 品牌重定位 | ✅ | 「日用百宝箱」badge/副标题/窗口标题/页面标题三语 + core/brand.py 同步 |
| 字号档 | ✅ | 外观弹层 4 档（15/16/17.5/19px），`<html data-fontsize>` + 根字号，全站 rem 缩放真实生效，localStorage + 防闪屏回放 |
| 流动背景 | ✅ | FluidBackground 3 blob（CSS animation，transform/opacity only，135-180s 循环，主题变量着色）；纹理 5 档含 fluid；reduced-motion 完全静止 |
| 回归 | ✅ | theme_drag_check 25/25；homenav_fav_flow 14/14；npm build 成功；pytest 127 passed；release_acceptance 全过 |
| EXE 重打包 | ✅ | `dist_release/ZonScale_Windows_x64_20260901.zip`（14:24）；内嵌前端指纹验证（index-DZ96rTiz.js + zs-fluid CSS + legacy 齐）；brand.py/desktop_app.py 变更触发 PYZ/PKG 重建 |
| Pages 部署 | ✅ | 线上主 chunk = index-DZ96rTiz.js，data-canvas-gesture 与 zs-fluid 指纹在线 |
| 遗留 | ⏳ | 方框拖动劫持修复需用户壳内真机复验（WebView2 手势接管路径无法 Playwright 模拟） |

## 2026-09-01 第二轮进度（主题/外观系统 + 拖拽层重构）

| 项 | 状态 | 说明 |
|---|---|---|
| CSS 变量主题层 | ✅ | `tailwind.config.js` mem-* 色板 + 硬阴影挂 CSS 变量（`rgb(var(--x) / <alpha-value>)` 保透明度语法）；`index.css` 4 套 `data-theme` 预设：cream/paper/slate/dark。`white` 归一到 `--mem-surface`，61 处 `bg-white` 深色下自动翻转；组件类名零改动 |
| ThemeProvider | ✅ | `lib/theme/`（themeCore + context）；localStorage `zonscale-theme`/`zonscale-texture`；`index.html` 内联脚本防闪屏回放 |
| 背景纹理 | ✅ | `none/grid/dots/paper` 纯 CSS 层（`zs-texture-*`），App 根容器渲染，跟随 ink 变量，零资产 |
| 外观选择 UI | ✅ | `AppearanceModal.tsx`（主题缩略卡 + 纹理档位即点即换）；Header 桌面/手机入口 + HomeNav 快捷入口；i18n `appearance.*` 三语 |
| 拖拽层重构 | ✅ | 删除 `WindowDragStrip.tsx`（覆盖条几何手工复刻，离线横幅下压时错位 + right-132px 魔法数字），改为 Header 品牌行自身 `app-region: drag` + 行内交互 `.no-drag`。实测横幅下推 43px 时拖拽行跟随对齐 |
| 壳层闪屏联动 | ✅ | 前端 `save_ui_prefs` api → `ui_prefs.json`；`desktop_app.py::_load_shell_bg()` 启动读它设 `background_color`（THEME_SHELL_BG 与 themeCore.ts 同表，须同步改）；round-trip 实测 dark→`#181826` |
| MemphisDecor | ✅ | 硬编码 hex 全改变量类；缓漂浮 CSS 动画（prefers-reduced-motion 关闭） |
| 回归 | ✅ | `theme_drag_check.mjs` 17/17（主题切换/持久化/防闪屏/纹理/拖拽几何双视口/零 pageerror）；`homenav_fav_flow.mjs` 14/14；npm build 成功；pytest 127 passed；release_acceptance 全过 |
| EXE 重打包 | ✅ | `dist_release/ZonScale_Windows_x64_20260901.zip`；内嵌前端指纹验证 = 本轮构建（`index-B556ldtk.js` + `zs-texture-grid` 特征串，与 dist_web/线上三方一致）；PyInstaller 因 `desktop_app.py changed` 重建 PKG（ui_prefs 闪屏联动进包）；release acceptance 全过 |
| Pages 部署 | ✅ | 生产 branch=main（2026-09-01），线上主 chunk = `index-B556ldtk.js` = 本地 dist_web，线上内容含本轮主题特征串 |
| 遗留 | ⏳ | 真实 WebView2 鼠标拖拽手感/深夜模式观感待壳内实机确认（Playwright 无法覆盖） |

## 2026-08-31 深夜后续进度（无边框桌面壳加固）

| 项 | 状态 | 说明 |
|---|---|---|
| GUI 线程死锁修复 | ✅ | `frameless_window.py` 所有 CLR 访问改经 `BeginInvoke(Action)` 排到 GUI 线程；`CoreWebView2` 改事件订阅（`CoreWebView2InitializationCompleted`）设 `IsNonClientRegionSupportEnabled=True`。修复前壳窗口必现 `IsHungAppWindow=True` 挂死 |
| 最大化遮任务栏修复 | ✅ | `WM_NCCALCSIZE` 钩子在 `IsZoomed` 时把客户区内缩到 `_monitor_workarea`（Chromium 同款）+ `Form.MaximizedBounds=WorkingArea`；实测最大化 client==workarea (0,0,2560,1528) |
| 64 位 ctypes 原型 | ✅ | `SetWindowLongPtrW`/`CallWindowProcW` 等显式 `argtypes/restype`（默认 32 位传参导致窗口过程指针 OverflowError） |
| 端到端验证 | ✅ | 壳内 evaluate_js：右上 3 按钮渲染 + pywebview.api 桥接；最小化→1 / 最大化→2 / 还原→0 状态机全通；窗口不挂死。Win32 消息级：HTTOP/HTLEFT/HTCLIENT 命中正确。Playwright：浏览器模式控制按钮不渲染、零 pageerror |
| 回归 | ✅ | pytest 127 passed（--ignore test_native_dialog）；release_acceptance 全过 |
| 遗留 | ⏳ | EXE 打包后需人工确认真实鼠标拖拽/边缘缩放手感（WebView2 鼠标路径无法消息级测试） |

## 2026-08-31 深夜进度（手机端导航 + 收藏）

| 项 | 状态 | 说明 |
|---|---|---|
| 底部导航栏 | ✅ | `MobileBottomNav.tsx`：手机端固定底部 5 tab（收藏/首页/智能脱敏/PDF 工坊/更多）；「更多」弹层列出全部中心；桌面端（md+）不渲染，零影响 |
| 工具收藏 | ✅ | `favoritesCore.ts`（localStorage，上限 12，跨中心）+ `FavoriteStar.tsx`（PDF 工坊首页卡片右上角星标）+ `FavoritesView.tsx`（收藏页：卡片跳转、取消收藏、空态引导文案） |
| 收藏页路由 | ✅ | redact 中心下虚拟 tool `favorites-view`；底部 tab 切换时**先回 redact 中心再切 tool**（修了一个真 bug：在其他中心直接切收藏会落进「功能维护中」占位符） |
| 触控目标 | ✅ | 底部 tab ≥44px 命中区（`zs-touch-target-mobile` 体系），active 态 Memphis 风格高亮 |
| i18n | ✅ | `favorites.*` / `mobileNav.*` 三语（zh-CN/zh-TW/en） |
| 实机验证 | ✅ | Playwright 390×844：底部导航渲染与高亮、收藏点星→收藏页出现→点击跳转全链路、三个页面横向溢出=0、零 pageerror；截图 `temp_ui_test/shots_mnav/`；脚本 `mobile_nav_check.mjs` / `mobile_fav_flow.mjs` |
| App.tsx 修复 | ✅ | 上会话遗留的 JSX 片段闭合错乱（构建失败 TS1381）已修 |
| 设计检测 | ✅ | impeccable detect.mjs 0 findings |
| 构建/回归/部署 | ✅ | npm build 2m44s 成功；pytest 127 passed；Pages 已部署（线上 = 本地 `index-SPDzCuv0.js`，HTTP 200） |
| 桌面壳 | ✅ | 无边框窗口改造（WindowDragStrip/WindowControls/frameless_window.py）随本轮一起提交——desktop_app.py 自绘标题栏，不影响浏览器端 |

## 2026-08-31 晚进度（转换工具浏览器引擎兜底）

| 项 | 状态 | 说明 |
|---|---|---|
| 浏览器转换引擎 | ✅ | 新增 `frontend/src/lib/toolknit/convertWebCore.ts`：后端离线时 7/8 转换工具自动降级浏览器本地处理（pdf→word/excel/ppt、office→pdf、html→pdf、compress-deep、pdf-repair）；文件零上传 |
| OCR 诚实降级 | ✅ | ocr-export 浏览器做不了（OCR 模型过大），显示「此工具需要本机引擎」引导桌面版，不虚标 |
| ConvertView 接线 | ✅ | capability 失败 → webFallback 自动启用；蓝条标注保真度差异；产物走 deliver.downloadBlob 统一出口；UI 布局零变化 |
| 许可合规 | ✅ | docx MIT / xlsx Apache-2.0 / pptxgenjs MIT / mammoth BSD-2 / html2canvas MIT / pdf-lib MIT——零 AGPL；动态 import 分 chunk 不进主包 |
| 栅格化技术路线 | ✅ | **html2canvas 逐节点重绘为首选**；foreignObject data-URL SVG 在 Chrome 100% 复现「source image cannot be decoded」，仅作回退（首版踩坑重做一次的教训） |
| 实机验证 | ✅ | Playwright 后端离线场景 6/6：pdf-to-word(excel/ppt) 产物 magic bytes 正确（PK/PK/PK）、compress-deep 与 html-to-pdf %PDF、中文加粗正常、ocr 桌面引导显示。脚本 `temp_ui_test/webconvert_final.mjs` |
| 构建 | ✅ | npm run build 32.8s；pptxgen 282KB / xlsx 430KB 独立 chunk |
| 后端回归 | ✅ | pytest 127 passed（后端零改动） |
| Pages 部署 | ✅ | zonscale.pages.dev → `index-CBxmc5sG.js`（含引擎特征串），HTTP 200 |
| EXE | — | 无需重打包（后端零改动，前端构建时自动打入 dist_web） |

### UI 测试基建备注

- Header 中心按钮在窄视口溢出隐藏：Playwright 须用 `button[title="…"]:visible` + ≥1366px 视口，否则解析到隐藏节点超时。

## 2026-08-31 收尾轮进度（P3 安全工具 + P4 收尾 + 打包/部署验证）

| 项 | 状态 | 说明 |
|---|---|---|
| P3 权限保护 | ✅ | pikepdf 全量加密（口令 + 权限位），端点 `/api/security/protect`；测试断言权限位与打开口令 |
| P3 证书签名 | ✅ | pyHanko 真 PAdES 签名 `/api/security/pades-sign`（自签证书+私钥 PEM 上传）+ `/api/security/verify` 验签；前端 Cert Sign 证书/私钥上传 UI 修复（838776d） |
| P3 路由与前端修正 | ✅ | p3 router 挂载 server_bridge（33a91ea）；同源 API 路径、mainboard/bios 渲染、cleanup 加载态、i18n 三语补键（838776d） |
| P4 导航重组 | ✅ | PDF 中心导航分组（组织/转换/编辑/安全）+ 工具首页宫格（7fc07e0） |
| P4 清理端点 | ✅ | `/api/system/cleanup/status`（监控 output + temp_bridge_files）；门禁 `cleanup_endpoints` 断言（e33aa2e + 67ff56c） |
| 桌面全功能复测 | ✅ | `temp_ui_test/full_feature_test*.mjs`（mobile 390×844 / desktop 1366×900 双模式）覆盖 8 中心 76 工具 + 导航 + 隐私弹窗 + 横向溢出检测；CanvasViewport 移动端触控目标微调（e80eb98，`zs-touch-target-mobile`） |
| Phase 9：EXE 重打包 | ✅ | `dist_release/ZonScale_Windows_x64_20260831.zip`（~280MB / 3776 条目）。**已验证内嵌前端与源码一致**：`_internal/dist_web/assets/index-BP5sWohB.js` 含最后一笔提交特征串，资产哈希与根 dist_web/、线上 Pages 三方一致 |
| Phase 10：Pages 部署 | ✅ | wrangler 直传生产 `https://zonscale.pages.dev`（部署 `50f68f08`）；线上资产 = 本地 dist_web/；curl 200 / 0.30s |
| 全量 pytest | ✅ | **127 passed**（33.8s，--ignore=tests/test_native_dialog.py；唯一告警 Starlette httpx 弃用提示）。121 → 127：新增 test_p3_security_tools.py（protect 权限位 / pades 真签真验 / verify）+ test_p4_gates.py（cleanup 结构 / capability 键） |
| 发布门禁 | ✅ | `release_acceptance.py` 全部通过：exe_exists / synthetic_pipeline（零残留）/ no_agpl_components / cleanup_endpoints / convert_capability_gate / generic_terms_in_rules（词表 9 条通用词） |
| 31 样本回归 | ⏳ | `Testing Drawings\` 目录本机不存在，`scripts/regression_acceptance.py` 未跑——样本到位后必跑 |

### 2026-08-31 提交清单（6 笔，e33aa2e → e80eb98）

- `e33aa2e` chore: system cleanup endpoint + release acceptance 通过
- `7fc07e0` feat(p4): PDF 中心导航分组 + 工具首页宫格
- `33a91ea` fix(backend): p3 router 挂载、pyhanko 真 PAdES、ffmpeg stderr 死锁、cleanup 端点+门禁
- `838776d` fix(frontend): 证书签名证书/私钥上传 UI、主板/BIOS 渲染、cleanup 加载态、同源 API 路径、i18n 键
- `67ff56c` test: p3 安全端点 + p4 清理门禁测试
- `e80eb98` chore(ui): 画布把手微调、docpdf/drawing 调整、全功能测试资产

## 2026-08-30 第2版进度 (P3 编辑器与纯前端特性集成)
- 表单填写(PDF Forms)
- 证书签名(pyHanko 后端打通)
- 手写签名板前端落盘
- 增强安全权限选项(`pikepdf`全量加密)
- 纯前端本地PDF画板/编辑器。

## 2026-08-30 进度（P2 端点补齐 + ConvertView 前端接线，第二轮）

| 项 | 状态 | 说明 |
|---|---|---|
| compress-deep | ✅ | pypdfium2 逐页栅格化（72–200dpi）+ JPEG 质量档重编码（30–95）→ reportlab 画布回写；响应含 original/compressed bytes 与压缩比百分比；如实标注「栅格化深度压缩，无可编辑文本层，适合扫描件/图片型 PDF，文字型走前端轻压缩」 |
| html-to-pdf | ✅ | 同步端点：HTML 子集解析器（h1-h6/p/div/ul/ol/table/blockquote/pre/hr + 内联 b/i/code/u；img 忽略并记提示，零联网取资源）+ Markdown 子集（标题/列表/引用/代码块/分隔线/粗斜体）；CJK 字体注册链 msyh.ttc → simhei.ttf → STSong-Light CID 兜底；接受 .html/.htm/.md/.txt 上传或直接粘贴内容（4MB 上限） |
| ocr-export | ✅ | 复用 `core.detector.ocr_channel` RapidOCR 引擎 + pypdfium2 渲染：TXT 分页纯文本 / 夹心 PDF（原页 JPEG + `setTextRenderMode(3)` 隐形文字层按识别框原位叠加，可搜索可复制）；rapidocr 不可用时 capability 置 false，前端 CapabilityGate 拦截不发起任务 |
| office 兜底链 | ✅ | COM 失败自动降级（job note+warnings 诚实标注，禁止静默）：Word → mammoth docx→HTML → reportlab platypus；Excel → openpyxl（data_only 缓存值）→ HTML 表格 → reportlab；COM 与兜底双失败时报错明示两条错误详情 |
| ConvertView | ✅ | `pdfcenter/ConvertView.tsx` 单组件覆盖 8 工具（pdf-to-word/excel/ppt + office-to-pdf/compress-deep/ocr-export 走 job 轮询；pdf-repair/html-to-pdf 同步）：CapabilityGate（后端离线提示 + OCR 缺失拦截）、进度条 + stage、压缩比/引擎/局限 note 如实展示、参数 chips（dpi/quality/输出格式）；产物走 MediaOutputList 统一交付 |
| 导航与接线 | ✅ | navigation.tsx PDF 工坊 17 项全 ready（新增 compress-deep/pdf-to-word/pdf-to-excel/pdf-to-ppt/office-to-pdf/html-to-pdf/ocr-export/pdf-repair）；api.ts 补 ConvertOp/ConvertJobStatus/ConvertCapability 类型 + startConvertJob/pollConvertJob/convertHtmlToPdf/convertRepair；i18n `convert.*` 命名空间三语（zh-CN/zh-TW/en）齐 |
| 测试 | ✅ | `tests/test_convert_tools.py` 13→22 用例：compress-deep 端到端（断言体积下降）、html-to-pdf markdown/HTML 表格/空输入 422、ocr-export TXT/夹心 PDF（pdfium 重新抽取验证文字层可搜索）、office 兜底链（伪造 COM 失败走 mammoth/openpyxl 路径并断言 note）、capability 新引擎上报；全量 `pytest -q --ignore=tests/test_native_dialog.py` → **121 passed**（原 112 + 新 9） |
| 构建/部署 | ✅ | `npm run build` 成功（21.6s，仅历史 chunk 体积提示）；Cloudflare Pages 已更新（zonscale.pages.dev）。线上 Pages 仅纯前端能力——转换 8 工具依赖 FastAPI 后端，线上显示后端离线属预期边界 |

### P2 剩余

- 浏览器级（Playwright）UI 实测：新转换 8 工具 + P0/P1 的 14 个 PDF 工具 + 脱敏全链路（Phase M 后首确保真）一起补一轮。
- 31 样本回归（`Testing Drawings\` 样本目录到位后跑 `scripts/regression_acceptance.py`）。

## 2026-08-30 进度（Phase M：PyMuPDF 退出迁移）

| 项 | 状态 | 说明 |
|---|---|---|
| **AGPL 清零** | ✅ | 全仓 `import fitz` 归零；requirements.txt 除名 PyMuPDF；开发环境已卸载；11 个测试文件 + 3 个脚本 + temp_ui_test 样本生成器全部迁移 |
| 新读取层 `core/pdfio.py` | ✅ | pypdfium2 渲染（Apache-2.0）+ pdfplumber 文本/矢量/图片抽取（MIT）+ pikepdf 控件值读取；坐标合同 = fitz 兼容显示空间（原点左上 y 向下随 /Rotate）；`/Rotate=90` 行为实测与 fitz 一致（pdfplumber 坐标本就是显示空间） |
| 新写入引擎 `core/redact/pikepdf_engine.py` | ✅ | 内容流走查（CTM/文本状态/Tm-Td-TJ）字形级真删除 + TJ 补偿量保位；字体宽度（/Widths、/W、标准 14 走 reportlab AFM）；图像像素化（CCITT/ImageMask/DCT/Flate + SMask）；线画 keep/touched/covered；`re f` 填充块；qpdf 只写可达对象 |
| executor 语义对齐 | ✅ | 普通框 = 整框相交删字形 + 格线保留 + 图像像素化 + 填充；Logo 框 = 触碰线画整块删（graphics=2 语义）；doc 公文 = graphics=covered（apply_redactions() 默认）+ COVER 仅涂白 |
| 检测/管线迁移 | ✅ | vector_channel / ocr_channel / image_verify / seal_detector / logo_matcher / box_finder / pipeline / doc_pdf pipeline / image_merge（reportlab）/ server_bridge 预览扫描 / backend_ppt_tools 渲染（pypdfium2）|
| 测试基建 | ✅ | `tests/pdf_helpers.py`：reportlab 合成样本 + pdfplumber/pdfium 断言（坐标合同=显示空间）；test_executor/test_pipeline/test_doc_pdf/test_box_finder/test_shrink/test_image_verify/test_image_merge/test_convert_tools/test_ppt_tools 全部去 fitz |
| 全量 pytest | ✅ | `pytest -q --ignore=tests/test_native_dialog.py` → **112 passed**（与迁移前同数量；PyMuPDF 已卸载环境下运行） |
| 发布门禁 | ✅ | `release_acceptance.py` 全部通过，新增 `no_agpl_components` 断言（环境已装组件 / requirements / fitz 可导入性 / 打包产物文件四路检查） |
| EXE 重打包 | ✅ | PyInstaller 重建 + 图标侧车 + `dist_release/ZonScale_Windows_x64_20260830.zip`；新 EXE 门禁含 AGPL 断言全绿 |
| 合成端到端回归 | ✅ | A3 图纸：4 命中 / 2 自动 / 3 待人工（与 2026-08-29 fitz 实测同构，残留=待人工项符合宪法）；公文：PII 8 类全净（手机/证件/护照/银行卡/信用代码/邮箱/香港号/座机）、正文保留（hits 12 vs 旧 11，印章/去重口径差） |
| 31 样本回归 | ⏳ | `Testing Drawings\` 目录本机不存在，`scripts/regression_acceptance.py` 未跑——样本到位后必跑 |
| 行为微差登记 | ✅ | D8 紧行距用例（基线差 18pt）：「放弃收缩」→「精确收缩+相邻行零污染」（pdfminer span 比 fitz 紧，3.5pt 容差带判定前移；字形净空 ~3.9pt 实测安全；测试改为直接断言安全属性）。引擎限制：WMode 1 垂直书写按水平度量、Inline image 不像素化、CropBox≠MediaBox 按 MediaBox |
| 关键踩坑记录 | ✅ | ① pypdfium2 `render(crop=)` 是「四边裁剪量」(left,bottom,right,top) 非坐标矩形，且在旋转后位图上应用；② pikepdf 对象 `hasattr(s,'as_bytes')` 触发属性→键回退抛 ValueError，须用 isinstance；③ 矩阵级联按 PDF 规范 4.2.3（写错会把平移翻倍）；④ CCITT 解码极性：pikepdf 出的是传真原始位（0=白），DeviceGray 回写需反转，ImageMask 保持原语义不反转 |

## 2026-08-30 进度（P2 转换引擎垂直切片：backend_convert_tools）

| 项 | 状态 | 说明 |
|---|---|---|
| 转换桥上线 | ✅ | 新增 `backend_convert_tools.py`（router `/api/convert`）：能力探测 `GET /capability`（引擎版本 + pywin32/Word/Excel COM 导入级探测，与 PPT 工坊同口径）+ job 轮询 `GET /jobs/{id}`（沿用音视频中心模式），产物落 `output/` 走 `/api/download` 与原生另存为 |
| PDF→Word | ✅ | 自研链路：pdfplumber 文本行（字号/粗体/坐标，剔除表格框内行）+ find_tables → python-docx 重建（标题分级/段落归并/Table Grid 表格/跨页分页符）；**规避 pdf2docx 的 PyMuPDF 硬依赖**；无文本层（扫描件）任务报错并引导 OCR 导出 |
| PDF→Excel | ✅ | pdfplumber 表格抽取 → openpyxl（每页一个 sheet，表头加粗、列宽自适应、纯数字单元格转数值）；未检测到表格时任务报错引导 PDF→Word |
| PDF→PPT | ✅ | pypdfium2 逐页渲染（72–300dpi，png/jpeg）→ python-pptx 整页贴图，幻灯片尺寸=PDF 页面尺寸；响应如实标注「视觉版式还原，非可编辑文本还原」 |
| Office→PDF | ✅ | Word/Excel COM（DispatchEx + 位置参数 + COM 全局锁；wdFormatPDF=17 / xlTypePDF=0）；pptx 引导走 PPT 工坊；无 Office 时任务报错明示（mammoth/reportlab HTML 兜底链后续接入，禁止静默降级） |
| PDF 修复 | ✅ | pikepdf（qpdf 内核）打开自动恢复损坏 xref/对象结构后重写，同步端点；不可修复返回 422 |
| 宽松许可依赖落库 | ✅ | requirements.txt 新增 pypdfium2/pikepdf/pdfplumber/python-pptx/openpyxl/mammoth/reportlab（全宽松许可，见 ILOVEPDF_INTEGRATION_PLAN §3）；**转换模块零 PyMuPDF 引用**（Phase M 退出起点） |
| server_bridge 接线 | ✅ | convert router 挂载（与 system/ppt/media 同 try/except 模式）；TestClient 冒烟 capability 200、引擎版本全部上报 |
| 测试 | ✅ | 新增 `tests/test_convert_tools.py` 13 用例全绿（reportlab/python-docx/openpyxl 现场合成样本端到端，含 Word/Excel COM 真转 + 文本断言；产物即测即清）；全量 `pytest --ignore=tests/test_native_dialog.py` → **112 passed** |

## 2026-08-30 进度（iLovePDF 功能对齐：P0 死资产接线 + P1 页面级工具）

| 项 | 状态 | 说明 |
|---|---|---|
| **iLovePDF 对齐方案** | ✅ | 新增 [ILOVEPDF_INTEGRATION_PLAN.md](ILOVEPDF_INTEGRATION_PLAN.md)：26 项功能对照矩阵、开源选型、分阶段计划（P0/P1/P2/P3/M/P4） |
| **许可决策：零商业授权** | ✅ | 不购买 Artifex 商业授权；PyMuPDF（AGPL）按 Phase M 退出（渲染→pypdfium2 Apache-2.0，写操作→pikepdf MPL-2.0 + pypdf BSD + reportlab BSD）；发布前完成迁移，转换引擎全部用宽松许可库 |
| PDF 水印 | ✅ | 新工具 `pdf-watermark`：文字/图片水印，透明度/角度/颜色/整页平铺；canvas 统一渲染→PNG 盖章（原生支持中日文，无需字体嵌入）；原 `officeCore.ts` 孤儿实现废弃 |
| PDF 范围拆分 | ✅ | `pdf-split` 双模式：逐页拆分（原行为）+ 按范围拆分（`1-3,5,8-`，支持开区间 `8-`），`parsePdfPageRanges` 共用解析器 |
| 图片转 PDF | ✅ | 新工具 `pdf-images-to-pdf`：多图按顺序合成（可调序），适应尺寸/A4 版式、页边距；canvas 归一化兼容 EXIF 方向与 WebP；**前端 pdf-lib 实现，不加深 PyMuPDF 依赖** |
| 提取页面 | ✅ | 新工具 `pdf-extract`：按范围提取页面合并为单个新 PDF |
| 添加页码 | ✅ | 新工具 `pdf-page-numbers`：六位置/三格式（1、1 / N、Page 1）/字号/起始页 |
| PDF 裁剪 | ✅ | 新工具 `pdf-crop`：四边等比收缩 CropBox（0–40%） |
| 交付链路统一 | ✅ | `pdfKit.downloadBytes`/`downloadImageZip` 从裸 `a[download]` 迁移到 `lib/deliver.ts` 统一出口（壳内=服务端中转+原生另存，浏览器=下载流；服务端中转失败自动回退浏览器通道） |
| 孤儿代码清理 | ✅ | 删除零引用的 `officeCore.ts`（水印/拆分能力已迁入 `pdfCore.ts`）；`requirements.txt` 补 `pywin32`（此前 PPT→PDF 的 PowerPoint COM 兜底在未手装 pywin32 的机器上静默失效） |
| 工程清理 | ✅ | `PdfToolId` 扩至 14 项；navigation/PdfCenter 注册；i18n 三语（zh-CN/zh-TW/en）全量补键 |
| 测试 | ✅ | 前端 `npm run build` 通过（仅既有 chunk 体积告警）；后端 pytest 全绿 |


## 2026-08-29 进度（手机兼容与导出交付轮）

| 项 | 状态 | 说明 |
|---|---|---|
| **老手机白屏根因** | ✅ | 构建产物仅含 `<script type="module">`：不支持 ES Module 的老内核（微信 X5、旧 Android WebView）执行不到任何 JS → 白屏；另 pdfjs-dist v6 主构建要求 Chrome 110/119+ |
| 修复：@vitejs/plugin-legacy | ✅ | Vite 6 配套 v6 插件：老内核走 SystemJS + core-js（polyfills-legacy 157KB + index-legacy 2MB），modern chunk 注入 Promise.withResolvers 等现代 polyfill；目标 Chrome ≥61 / Safari ≥11 / Firefox ≥60 |
| 修复：pdfjs-dist 降级 v4 | ✅ | 4.10.38 + `legacy/build/pdf.mjs`（自带 polyfill）；`pdfRender.ts` 渲染失败翻译为「浏览器内核过旧」用户可读提示 |
| 修复：手机浏览器导出链路 | ✅ | 根因：`ExportDownloadButton` 一律走 `/api/export/save-as`，原生另存为对话框弹在**服务器电脑**上，手机用户永远取不到文件。现按环境分流：桌面壳=原生另存为；手机/桌面浏览器=`/api/download/{filename}` 下载流（Content-Disposition attachment）。「打开」按钮仅壳内显示 |
| 修复：壳内 blob 产物中转 | ✅ | 新增 `/api/export/save-blob`：纯前端工具（PPT 提取/瘦身、图片编辑等）内存 blob 先落 output/ 再走另存为；浏览器模式保留直接 a[download]。`lib/deliver.ts` 统一交付层，`downloadBlob` 自动分流 |
| 修复：导出命名 | ✅ | PPT 渲染产物名原带临时前缀 `src_xxxxxxxx_`；改取上传原始文件名（如 `测试演示.pdf` / `测试演示_images.zip`） |
| 修复：转长图导出文案 | ✅ | ZIP 导出按钮原误标「导出 PDF」，改 `export.labelZip` |
| 修复：局域网 HTTP 剪贴板 | ✅ | 非 HTTPS 下 `navigator.clipboard` 不存在致复制按钮静默失效；`copyTextToClipboard` 增加 execCommand 回退 |
| 隐私与联网声明弹窗 | ✅ | `OfflinePrivacyNotice.tsx` 首访自动弹出（localStorage 记忆，页眉盾牌可重开）；按运行模式如实告知：桌面壳=完全离线 / 局域网=设备间直传 / 隧道=TLS 加密中转不存储；微信内置浏览器提示换系统浏览器；i18n 三语 |
| 手机视口实测（390×844） | ✅ | IAB + DataTransfer 注入真实 pptx：隐私弹窗全流程、PPT 转 PDF（PowerPoint COM）→ 导出 PDF 下载事件 ✓、转长图 → 导出 ZIP 下载事件 ✓、文本提取 txt ✓、瘦身自动下载 ✓、其余 6 中心渲染冒烟 ✓；`/api/download` 200 + application/pdf + attachment 断言 ✓ |
| 测试 | ✅ | test_ppt_tools / test_router / test_app_paths 9 passed；前端 `npm run build` 含 legacy 产物成功 |

### 手机端联网边界（弹窗文案依据）

- 桌面壳：完全离线，文件不出本机。
- 局域网模式（`启动局域网手机访问.bat`）：页面由同一 WiFi 的电脑提供，文件只在手机↔电脑直传，不经过互联网。
- 公网隧道模式（`启动公网手机访问.bat`）：经 Cloudflare TLS 加密隧道连回电脑，云端不存储内容，处理仍在本机。
- 手机端首次打开需网络加载页面本身；使用期间须保持与电脑的连接，但文件处理不依赖任何外部互联网服务。

## 2026-08-29 进度（手机端适配轮 + 公网隧道交付）

| 项 | 状态 | 说明 |
|---|---|---|
| 全功能公网访问（手机可用） | ✅ | 后端跑本机 + cloudflared 快速隧道（`启动公网手机访问.bat` 一键重启）；URL 每次重启会变 |
| 静态前端公网 | ✅ | Cloudflare Pages `zonscale.pages.dev`（纯前端工具；项目名 zonscale，wrangler pages deploy dist_web） |
| 手机端可读性 | ✅ | `index.css` 手机断点（<768px）html 基准字号 16→17.5px，全站 rem 等比放大，小字/触控目标同步增大，无需捏合缩放 |
| 缩放手势保障 | ✅ | `html { touch-action: manipulation }`：保留捏合缩放、仅禁双击缩放（消误触）；`text-size-adjust: 100%` 防浏览器擅改字号 |
| 一级中心 Tab | ✅ | 手机横滚 Tab 激活项显示文字（此前手机端仅图标不可辨识） |
| 二级工具 pills | ✅ | 修正写反的断点（此前手机字号反而小于桌面），py-2 触控目标 + 隐藏滚动条（zs-mobile-scroll-x） |
| 审计三卡/规则中心 | ✅ | 统计卡响应式（p-3/gap-2.5），手机视口 390px 实测零横向溢出 |
| 手机视口实测 | ✅ | Playwright 390×844：6 中心导航可见、首页/脱敏/PDF/PPT/规则/审计截图目检通过 |

## 2026-08-29 进度（工坊实机修复轮）

| 项 | 状态 | 说明 |
|---|---|---|
| **PDF 工坊"都不能用"根因定位** | ✅ | 代码本身正常（Playwright 实测 Chromium 9/9 工具全通过、零报错）；真因：pywebview 默认 `ALLOW_DOWNLOADS=False`，WebView2 壳内**所有浏览器 blob 下载被静默取消**——而 PDF 工坊 9 个工具的产物全部走 blob 下载 |
| 修复：desktop_app.py 放开下载 | ✅ | `webview.settings['ALLOW_DOWNLOADS'] = True`（`_open_pywebview`）；放开后 WebView2 弹原生"另存为"对话框（pywebview edgechromium.py `on_download_starting`），符合"输出副本不改原文件"语义 |
| PPT 转 PDF / 转长图 | ✅ | 新增 `backend_ppt_tools.py`（FastAPI `/api/ppt/render`）：LibreOffice 优先，Windows 回退 PowerPoint COM（DispatchEx + WithWindow=False + ppSaveAsPDF=32）；images 目标经 PyMuPDF 逐页渲染打包 ZIP；产物写入 `output/` 走 `/api/download` 与原生另存为，不经 blob 下载通道 |
| PPT 大纲生成（原"AI 大纲"） | ✅ | 更名"大纲生成"（诚实命名，非 AI）：离线模板驱动（`pptOutlineCore.ts`，8 种演示类型角色序列 + 双语模板），产出可编辑 Markdown |
| PPT 草稿生成（原"AI 草稿"） | ✅ | 更名"草稿生成"：`pptDraftCore.ts` 纯 JSZip 构建合法 OOXML（16:9，两种主题）；产出经 PowerPoint COM 实测可打开并导出 PDF |
| OOXML 兼容性修复 | ✅ | 二分定位两处 PowerPoint 拒开问题：① theme `fmtScheme` 需恰好 3 组 fill/line/effect/bgFill（原版 ToolKnit 只有 1 组）；② `p:sldSz type="wide"` 非法（ST_SlideSizeType 无 "wide" 枚举值），去掉 type 属性 |
| UI 实测（Playwright） | ✅ | PDF 工坊 9/9、PPT 工坊 4 新工具全通过零报错；草稿产物经 python-pptx 结构校验 + PowerPoint COM 打开验证 |
| pytest | ✅ | 新增 `tests/test_ppt_tools.py`（渲染端到端真跑 COM，无渲染器环境自动 skip） |
| 前端构建 | ✅ | `npm run build` → 成功（2607 modules） |
| ToolKnit 接线 | ✅ | **55 ready / 5 planned**（PPT 工坊 7/7 ready） |

### 关键证据链（PDF 工坊壳内不可用）

1. 用户报告 PDF 工坊所有工具"不能正常使用"；
2. Chromium 浏览器实测 9/9 通过 → 排除代码缺陷与 dist_web 过期（EXE 内嵌 bundle 哈希与现源码构建一致）；
3. 用户运行形态 = pywebview 壳 → 检查 `webview/platforms/edgechromium.py:315` `on_download_starting`：`ALLOW_DOWNLOADS=False` 时 `args.Cancel = True`（默认值 False，见 `webview.settings`）；
4. 所有工具"点执行后无任何反应"与"下载被静默取消"完全吻合 → 修复后放开开关 + 原生另存为对话框。


## 2026-08-29 进度（智能脱敏 UI 实测轮）

| 项 | 状态 | 说明 |
|---|---|---|
| 环境就绪 | ✅ | `http://127.0.0.1:8765` 200；`/api/status` → `ocr_available=true`，`active_rules_count=20`，引擎在线 |
| 实测1 工程图纸脱敏 | ✅ | 合成 `sample_drawing.pdf` → 识别 4 处 → 执行 → 输出 `output/sample_drawing_desensitized.pdf`（审计抹除 2 处，见下方问题清单） |
| 实测2 公文 PDF 脱敏 | ✅ | 合成 `sample_doc.pdf` → 识别 11 处 PII/敏感词 → 执行 → 输出 `output/sample_doc_desensitized.pdf` |
| 实测3 Word 文档脱敏 | ✅ | 合成 `sample.docx` → 扫描命中 7 处 → 执行 → 输出 `output/*_redacted.docx` |
| 实测4 规则策略中心 | ✅ | 增词 → 删词 →「保存工程图纸规则」；PII/Word/印章规则面板加载正常 |
| 实测5 审计日志流水 | ✅ | `/api/audit/logs` 累计 4 文档 / 27 抹除项；UI 刷新可见本次 3 条新记录 |
| 截图证据 | ✅ | `temp_ui_test/shots/`（01_drawing_* / 02_doc_pdf_* / 03_word_* / 04_rules_* / 05_audit_* + `results.json`） |
| 自动化脚本 | ✅ | `temp_ui_test/run_ui_tests.mjs`（Playwright headless，约 29s 全绿） |

### 设计规范审查摘要（Vercel Guidelines / 交互美学 · 只读，未改代码）

**做得好的：**
- 二级 SubNav 固定高度，中心切换无 CLS 跳变（符合 AGENTS_HANDOFF 第四节偏好）。
- 脱敏前/后预览切换、Toast 成功反馈、命中列表与画布框联动清晰。
- Memphis 品牌一致性（粗边框、Pastel 色板、Display 标题）在 5 个 redact 子页保持统一。
- 规则中心双栏信息架构合理；审计页三指标卡 + 流水列表可读。

**问题清单 + 修改建议（优先级排序）：**

| # | 严重度 | 问题 | 建议 |
|---|---|---|---|
| P1 | 高 | 工程图纸识别 4 处但默认仅 **2/4 选中**，执行后审计仅抹除 2 处；用户易误以为「已全部脱敏」 | 识别完成后默认全选；或执行前当「已选 < 命中总数」时二次确认；执行按钮文案区分「执行已选 N 处」 |
| P2 | 中 | 审计流水展示 **服务端 UUID 文件名**，非用户上传原名 | 日志 API/UI 增加 `original_filename` 字段并优先展示 |
| P3 | 中 | 脱敏完成后左侧 **3～4 个同级主色 CTA**（打开/导出/重新脱敏）视觉权重相同 | 按 Emil 式层级：单一 Primary（导出），其余 Secondary/Ghost |
| P4 | 中 | 空画布区 **MemphisDecor 浮动色点** 易被误认为加载异常或脏数据 | 限制装饰仅在 Header/背景层，工作区留白；或降低对比度 |
| P5 | 低 | 辅助文案 10–11px + `text-mem-ink/50` 对比度逼近 WCAG AA 下限 | 正文辅助提升至 12px / `text-mem-ink/60`；关键操作说明不用低于 AA |
| P6 | 低 | 命中列表/删除图标点击热区偏小（约 24px） | 扩至 44×44px 或增加 padding；保留 Del 快捷键提示 |
| P7 | 低 | 根容器 `select-none` 导致 Word 预览区无法复制文本对照 | Word/公文预览区局部 `select-text` |
| P8 | 低 | 导出路径输入只读且截断，无 tooltip 展示完整路径 | 只读 input 加 `title` 或 hover tooltip |

### 实测命令（可复现）

```powershell
# 1. 启动服务（若未运行）
cd C:\Users\Zonlic\Desktop\ZonScale
python -m uvicorn server_bridge:app --host 127.0.0.1 --port 8765

# 2. 生成合成样本
python temp_ui_test/make_samples.py

# 3. 自动化 UI 实测 + 截图
cd temp_ui_test
node run_ui_tests.mjs
# 结果 → shots/results.json
```

## 2026-08-29 进度（PDF 工坊第二批）

| 项 | 状态 | 说明 |
|---|---|---|
| PDF 转图片 | ✅ | `pdfToImages()` — PDF.js 2× 渲染 PNG/JPEG，ZIP 批量下载 |
| PDF 加密 | ✅ | `encryptPdfFile()` — cryptpdf AES-256 Rev 5 |
| PDF 解密 | ✅ | `decryptPdfFile()` — 口令验证后输出无密码副本 |
| PDF 扫描增强 | ✅ | `enhancePdfScan()` — 对比度/灰度/二值化逐页重建 |
| PDF 页面编辑器 | ✅ | `rebuildPdfFromPages()` — 重排/旋转/删除后导出 |
| 前端构建 | ✅ | `cd frontend && npm run build` → **成功**（2607 modules，5.44s） |
| ToolKnit 接线 | ✅ | **51 ready / 9 planned**（PDF 工坊 9/9 ready） |

### 后续批次（用户 2026-08-29 指定，PDF 批次已完成）

1. ~~PDF 转图片 / 加密 / 解密 / 扫描增强 / 页面编辑器~~ ✅；2. 视频转码 / 视频转 GIF；3. 调性检测（口径待确认）；4. 色彩空间色域对比。其余 planned：PPT 转 PDF/转图片/AI 大纲/AI 草稿、离线转写、打字测速。

## 2026-08-29 进度（ToolKnit 整合收尾轮）

| 项 | 状态 | 说明 |
|---|---|---|
| ToolKnit 60 项工具整合（Phase 1-8） | ✅ | 8 大中心全部挂载；46 ready / 14 planned（planned 显示"即将上线"占位），明细见 [TOOLKNIT_INTEGRATION_PLAN.md](TOOLKNIT_INTEGRATION_PLAN.md) 第五节 |
| 孤儿文件清理 | ✅ | 删除旧 `navigation/Header.tsx`、孤儿 `pdf/PdfStudioView.tsx`、5 个空组件目录、`packaging/windows/tools/rcedit-x64.exe`（图标方案定为 PyInstaller 嵌入）、`zonscale-test.ico`、根目录 `_tmp_*.pdf` ×24、`startup_error.log` |
| 计划文档状态登记 | ✅ | TOOLKNIT 计划追加执行状态章节（阶段提交/接线统计/后续批次）；docs/README 索引补全；AGENTS_HANDOFF 重写为当前状态 |
| pytest 全量回归 | ✅ | `python -m pytest -q` → **95 passed in 173.51s** |
| 前端最终构建 | ✅ | `cd frontend && npm run build` → **成功**（2599 modules，4.55s；仅 chunk >500kB 体积提示，无错误） |
| release_acceptance 发布门禁 | ✅ | **全部通过**：source_rules（9 条通用词，无厂商词）/ exe_bundled_rules / exe_exists / synthetic_pipeline（残留为零，保护内容保留）/ generic_terms_in_rules |
| 合成样本 UI 实测（上午） | ✅ | FastAPI 桥响应 200；UI 偏好代码核实 |
| `temp_ui_test/` 处置 | ⏳ | 未跟踪目录（含实测脚本/截图/样本），未入 git；待用户决定清理或 gitignore |

## 2026-08-26 进度（ZonScale 现代化工作台）

| 项 | 状态 | 说明 |
|---|---|---|
| 品牌重塑 ZonScale · by zonlic | ✅ | 艺术字标、龙鳞图标、窗口/页面标题统一 |
| React + FastAPI 孟菲斯 UI | ✅ | `frontend/` + `server_bridge.py` + `dist_web/` |
| Windows exe 打包 | ✅ | `dist/ZonScale/ZonScale.exe`（PyInstaller + pywebview） |
| exe 导出 PDF / 选路径 | ✅ | Windows 原生另存为 + 文件夹浏览（ctypes，非 tkinter） |
| 支持作者弹窗 | ✅ | 支付宝/微信收款码 + 趣味打赏文案 |
| 三语切换 简体/繁體/EN | ✅ | Header 语言按钮，localStorage 记忆；作者简介固定繁体「一個在香港生存的普通人」 |
| 核心脱敏回归（CLI） | ✅ 历史 | 31 样本全绿（2026-08-17 基线） |

### 现代化 UI 验收命令（2026-08-26）

```powershell
cd frontend && npm run build          # dist_web 构建
python -m pytest -q tests/              # 后端单元测试
python -m PyInstaller --noconfirm packaging\windows\config\ZonScale.spec  # exe（可选）
```

- 前端构建：`npm run build` → **PASS**（1837 modules）
- exe 启动：`dist\ZonScale\ZonScale.exe` → HTTP 8765 **200**
- 语言切换：简体 / 繁體 / EN，刷新后保持；`document.title` 随语言更新

---

## 阶段进度（历史基线 2026-08-17）

| 阶段 | 状态 | 备注 |
|---|---|---|
| 产品定义/方案/验收规则 | ✅ 完成 | 见 AGENTS.md 项目定位与验收规则 |
| 核心源码（core/ 三通道+归位+执行） | ✅ 完成 | CLI 可用的首个闭环 |
| CLI 入口 main.py | ✅ 完成 | --mode/--output/--no-ocr/--audit |
| 样本回归双重证据（文本零命中+像素级验证） | ✅ 全绿 | 31 样本 / 197.5s |
| 实机确认（用户侧） | ✅ 已闭环 | D3/D4 已修复复验 |
| D3 图片内容验证 + 词表判别 token 归一 | ✅ 完成 | image_verify.py + rule_engine.match_image |
| R1 PART NUMBER 表误抹 | ✅ 已修复 | 内容验证未命中降级待人工，像素证据零变化 |
| D4 栅格框线检测（cv2） | ✅ 完成 | box_finder 栅格线+局部方框归位 |
| D8 行级收缩（用户授权）+ 相邻行保护 | ✅ 完成 | shrink.py；ES-09805 防切字 |
| LogoMatcher 模板匹配检测 | ✅ 完成 | logo_matcher.py 视觉多尺度金字塔加速匹配 |
| 自定义输出目录 + 默认 output + Zip 导出 | ✅ 完成 | UI 路径选择器、安全解析应用根目录 output、支持无权限安全 fallback 与 zip 归档 |
| 交互式预览（滚轮缩放 + 拖拽平移） | ✅ 完成 | preview.py 支持直接滚轮缩放与鼠标拖拽平移 |
| 人工干预（画框抹除/取消抹除/清空/确认） | ✅ 完成 | UI 支持框选手选画框、单项取消抹除、清空抹除；core/pipeline 提供统一交互 API |
| 规则管理与热重载 | ✅ 完成 | UI 规则管理对话框（查看/添加/修改 sensitive_terms.txt）+ Pipeline 热重载 |
| pytest 单元测试 | ✅ 完成 | 78 passed（rule_engine / box_finder / executor / pipeline / image_verify / shrink / ui / logo_matcher / manual_box） |
| PyQt5 UI（ui/） | ✅ 完成 | 一键模式 + 批量 + 自定义输出 + 双预览自由缩放拖动 |
| 用户文档（docs/） | ⏳ 未开始 | 后续 |
| PyInstaller 打包 | ✅ 完成 | `dist/ZonScale/ZonScale.exe`，2026-08-26 验收 |

## 架构概览

- `core/model.py`：Box/RedactBox/RedactMode(ERASE|COVER)/PageResult/FileResult。
- `core/detector/rule_engine.py`：外部词表 + 大小写不敏感 + 长词编辑距离容差（单词级）。
- `core/detector/vector_channel.py`：文字层 span 提取 + 图像 XObject 提取（面积占比 <0.5 过滤）。
- `core/detector/ocr_channel.py`：300dpi 渲染（MAX_SIDE_PX=4096）→ RapidOCR，单例引擎。
- `core/detector/fusion.py`：IoU 0.5 去重 + 邻框距离 20pt 合并。
- `core/boxing/box_finder.py`：格线提取（line_tol=1.5、gap_tol=3.0）→ 最近封闭格向上归位 → FALLBACK 标记人工。
- `core/redact/executor.py`：output_path_for 命名；两阶段 apply_redactions（字形内缩框 1.5pt / 图像完整框）；Stamp 注释清理；ERASE/COVER。
- `core/pipeline.py`：Pipeline + PipelineConfig + to_audit_dict（审计 JSON 统一序列化）+ redact_result（人工确认执行通道，UI/CLI 共享）。
- `core/model.py`：RedactBox.box_id（框唯一标识，人工确认引用）。
- `ui/main_window.py`：PyQt5 主窗口（文件选择、ERASE/COVER 模式、命中清单表格、页面渲染+框色叠加[绿=自动/红=待人工/蓝=已确认/黄=选中]、确认执行、输出与审计落盘）；检测走 QThread 不阻塞界面；默认输出路径复用 executor.output_path_for。
- `scripts/regression_acceptance.py`：全量回归（输出+audit+文本零命中+像素视觉+summary.json）。
- `scripts/verify_visual.py`：单文件像素级验收（框内 std/residual、框外 3pt 带墨删/墨增）。
- `scripts/ui_screenshot.py`：offscreen 渲染主窗口截图（人工目检辅助）。

## 最新验收证据（2026-08-17，ES-09805 回归修复轮）

命令：`python scripts\regression_acceptance.py`（工作目录=项目根，31 样本）

```
自动执行文本层零命中: PASS
像素级视觉验证:      PASS
Total 163.1s
```

- 31 份全部产出（0 no-auto），视觉全部 PASS；ES-09805-1_AC_1 由 FAIL 转 PASS（相邻行保护生效）。
- manual 分布：21 份 0 manual、9 份 1 manual、1 份 2 manual（31 全量明细见 `outputs/acceptance/summary.json`）。

### pytest 单元测试（2026-08-17，ES-09805 修复轮）

命令：`python -m pytest -q` → **71 passed in 5.80s**

- 新增 4 测试（test_shrink.py）：相邻行近→放弃收缩 / 相邻行远→正常收缩 / 命中行自身 span 忽略 / 端到端行距近保持整格。

## 债务与设计取舍登记

| 编号 | 类型 | 内容 | 后续入口 |
|---|---|---|---|
| D1 | 债务 | AA01 老图 OCR 将 FISHER 识别为 FISHERO，漏检依赖人工复核（模型上限，不追模型级增强） | UI 人工确认环节 |
| D2 | 债务 | GK20284_MARKUP_B 自动框 (510,777)-(798,795) std14.4/residual1.07%（阈值内）待目检复查 | UI 目检 |
| D3 | ✅ 已修复 | 公司 Logo 未脱敏（根因：图片无封闭格线 FALLBACK + OCR 词表粒度错配）。修复：`image_verify.py` 图片内容验证（crop OCR → rule_engine.match_image 判别 token 交集），验证命中 → 补漏自动执行。ES-09708-1_AB_1 / ES-09805-1_AC_1 页脚 Logo 已自动执行且抹除干净（ink 0.127→0） | 已闭环 |
| D4 | ✅ 已修复 | 粗糙扫描图方框未整框抹除（根因：框线是栅格像素，box_finder 只认矢量格线）。修复：`box_finder` 栅格框线检测（150dpi 渲染 + 行/列投影实心段提取全局线 + 局部边扫描 `_snap_raster_box` 闭合方框）。13b3422/1C4957_H/AB01/AA01 由全 manual 转全部自动执行 | 已闭环 |
| R1 | ✅ 已关闭 | 右上 PART NUMBER 表图片被自动执行误抹（用户确认是误抹）。修复：内容验证未命中 → 强制降级待人工。像素证据零变化（ink 0.106→0.106） | 已闭环 |
| D5 | 债务 | ES-09708-1_AB_1 左上 (27,27)-(342,255) 与 GK20284_MARKUP_B (798,702)-(927,753) 图片验证未命中 → 降级待人工（保守行为，待 UI 人工确认是否需抹） | UI 人工确认环节 |
| D6 | 已复现分析 | **用户实机报告（2026-08-17 第二轮）**：CONFIDENTIAL 未整框抹除——"有一些，不是全部"。**实机证据（第三轮，2026-08-17 下午）**：`ABB01_18A0644_B_desensitized.pdf` 两框区域像素 mean=0/std=0（纯黑块）= COVER 黑块覆盖模式产物（ERASE 对同文件复现 mean=255 正常白块）；`MARSHALLTOWN` 待人工未确认 → 原样残留（符合宪法非 bug）。结论：非核心机制缺陷，为模式选择 + 未确认待人工项。UI 已改"一键模式"（用户授权全部执行，默认 ERASE） | 待用户实机复验 |
| D7 | 已复现分析 | **用户实机报告（2026-08-17 第二轮）**：公司 Logo 没有抹除效果。**实机证据（第三轮）**：ABB01 Fisher Controls 区域（216.72,464.4)-(518.64,540.24) 为 COVER 黑块（同 D6 根因），黑块视觉突兀被用户视为"无抹除效果"；`1C4957_H_desensitized.PDF` 三框 ERASE 白块残留 0%（抹除正常）。结论：与 D6 同根因（COVER 模式），机制正常 | 待用户实机复验 |
| D8 | ✅ 已修复 | **用户实机报告（2026-08-17 第二轮）**：误抹除图纸的其他信息（整格连坐抹除格内非敏感内容：图纸编号、材料规格等）。修复（用户授权，交接后实施）：`shrink.py` 行级收缩——纯文字命中时收缩到"命中 source_box 并集 + padding"，命中覆盖 >70% 或含图片命中保持整格。**回归修复（本轮）**：shrink 引入 ES-09805 相邻行切字（行距 <3.2pt 时 MuPDF full 框相交即删连坐删除相邻行字形，band_removed 0.052/0.063 超阈）→ 相邻行保护：收缩候选框外扩 3.5pt 带内有非命中矢量 span 时放弃收缩保持整格。ES-09805 visual FAIL→PASS | 待用户实机复验新行为 |
| T1 | 取舍 | 抹除框与格线共享像素时 MuPDF 切割极小线段（band ≤4%），安全优先 | verify_visual band 阈值 5% 已固化 |
| T2 | 取舍 | 图像区 ERASE 用 PIXELS 像素化（防整图删除），render 正常输出纯白 | 无 |
| T3 | 取舍 | D3 采用"内容验证"而非"区域先验"：不依赖页眉/页脚位置假设，对所有无文字支撑图片定向 OCR 核对，正确性更稳（区域先验无法区分 Logo 与 PART NUMBER 表） | 无 |
| T4 | 取舍 | 相邻行保护容差 3.5pt（= padding 2pt + 字形渲染溢出 ~1.2pt + 余量）为启发式：MuPDF `PDF_REDACT_TEXT` 无"完全包含才删"档位，只能从 shrink 决策层规避"full 框相交即删"；宁可不收缩（整格连坐）不可越框切字。行距 ≥3.5pt 的表格仍正常收缩 | ES-09805 修复已闭环 |

## 功能需求登记（用户实机验收提出）

| 编号 | 需求 | 说明（用户原话要点） | 状态 |
|---|---|---|---|
| F1 | 批量导入、批量抹除 | 当前 UI 单文件处理；需支持多文件导入并批量执行 | ✅ 已实施（2026-08-17 第三轮）：文件队列面板（多选导入/移除/清空）、检测全部（串行 QThread 复用 OCR 引擎）、批量执行（逐文件 auto+已确认项，输出 `原名_desensitized.pdf`+audit）、文件状态实时刷新；per-file 确认集合隔离 |
| F2 | 图纸预览：前后对比双区域 | 脱敏前/脱敏后两个区域并排展示；可用滑轮缩放；预览清晰 | ✅ 已实施（2026-08-17 第三轮）：右侧 QSplitter 双 `PreviewView`（QGraphicsView 重渲染缩放，上限 4096px 防内存爆），执行后右区自动加载输出 PDF；翻页/缩放双区联动 |

## 实机确认记录（2026-08-17，用户侧证据）

### 第一轮（D3/D4 来源）

- 用户确认脱敏效果时发现两类问题，已登记为债务 D3/D4（上方）：
  1. **公司 Logo 没有脱敏效果**。
  2. **粗糙扫描图的 CONFIDENTIAL 方框没有抹除干净**：部分只抹除了 CONFIDENTIAL 文字，没有抹除整个方框。
- 处理原则：先复现、收集证据、建立可证伪假设再修改；在根因未复现前不声称修复。
- **闭环状态**：D3/D4 已复现定位 → 用户确认修复方向 → 实施 → 回归复验全绿（见"D3/D4 修复实施记录"）。

### 第二轮（2026-08-17，UI 实机验收，只记录未改代码）

用户实机验收后报告 4 个问题 + 2 个功能需求，全部登记（债务 D6/D7/D8、需求 F1/F2，见上方表格），**未改代码**：

1. **CONFIDENTIAL 没有整个方框抹除**（"有一些，不是全部"）→ D6 待复现。
2. **公司 Logo 没有抹除效果** → D7 待复现（与 D3 修复后样本结果冲突，需实机文件定位差异）。
3. **误抹除图纸的其他信息** → D8 待用户提供具体案例。
4. **无批量导入/批量抹除** → F1 功能需求。
5. **无图纸预览**（脱敏前/脱敏后双区域、滑轮缩放、预览清晰）→ F2 功能需求。

处理原则：用户实机证据优先于回归结论；先复现再修复；F1/F2 为 UI 功能开发，待 D6-D8 确认后统一规划或先行（用户决策）。

### 第三轮（2026-08-17 下午，实机文件证据分析 + F1/F2 实施）

用户提供两张实机输出文件（`ABB01_18A0644_B_desensitized.pdf`、`1C4957_H_desensitized.PDF`），要求先做功能。本轮：

1. **D6/D7 实机证据链（只读分析，未改核心机制）**：
   - 两文件均为整页 CCITT 传真位图（无文字层无矢量），全部内容来自 OCR 通道。
   - 文本层检查：两输出 PDF 敏感词零残留（CONFIDENTIAL/Fisher/MARSHALLTOWN 均无）。
   - 像素检查：`1C4957_H` 三框 ERASE 白块残留 0%（mean=255）；`ABB01` 两框纯黑（mean=0/std=0）= **COVER 黑块覆盖模式**产物；对 ABB01 源复现 ERASE → 白块正常（mean=255）。
   - `ABB01` 的 `MARSHALLTOWN` 待人工项未确认 → 原样残留（宪法允许行为，非 bug）。
   - **结论：D6/D7 根因 = 用户实机执行时处于 COVER 模式（黑块视觉突兀被解读为"未抹除"）+ 待人工项未确认**。核心机制（ERASE 白块）经最小复现验证正常。
   - 修复方向候选（待用户确认）：执行前模式确认提示（含 COVER 黑块视觉说明）；D8 在本轮文件无证据（diff 仅在抹除框内），仍待具体案例。
2. **F1 批量 + F2 对比预览已实施**（见功能需求表）：`ui/preview.py`（新增）、`ui/main_window.py`（重构）、`tests/test_ui_batch.py` + `tests/test_ui_preview.py`（新增 6 测试）。验收：pytest 60 passed、样本回归 189.9s 全绿（文本抹净 PASS/视觉 PASS）、截图 `outputs/acceptance/views/ui_batch_preview.png`（批量队列 + 前后对比实景）。
3. 模式选择提示未实施（D6/D7 修复方向未确认前不加 UI 文案，避免猜测式修改）。

## D3/D4 复现定位结论（2026-08-17，只读取证，未改代码）

### D3（Logo 未脱敏）——根因确认

因果链（逐环证据）：

1. ES-09708-1_AB_1 / ES-09805-1_AC_1 页脚 (618.58,733.26)-(754.14,820.42) 是 XObject image（xref 7），直接 OCR 识别为 'EMERSON'(0.995) / 'LOUISVILLE, KENTUCKY, USA'(0.982) → **公司 Logo/名称标记**。
2. `vector_channel.extract_images` 命中该图（channels=['vector_image']）。
3. `box_finder`：该图无封闭格线 → FALLBACK → `manual_required=True` → 宪法禁止自动执行 → 输出中该图原样保留（xref 7 未重写、crop 前后 mean_diff=0.13、changed=0.001）。
4. **OCR 兜底失效根因 = 词表粒度错配**（决定性实验）：整页 4096px 渲染下 RapidOCR 检测出 'EMERSON' 与 'LOUISVILLE, KENTUCKY, USA'（score 0.98+），但 `RuleEngine.match('EMERSON')=[]`——词表条目是完整短语（'Emerson Louisville, Kentucky, USA'），OCR 输出是独立单词/短短语，单词 token 与整短语做编辑距离比较无意义 → 不产生 OCR hit → 无补救路径。排除"渲染缩放漏检"假设（MAX_SIDE_PX=4096 时该页 scale=0.825，但 OCR 仍检出 EMERSON）。
5. 宪法规定"标题栏/边框区内的图片对象自动高置信命中"，**当前实现无区域先验**，全部依赖 box_finder 归位 → 该机制缺失。

同类受影响文件：ES-09708-1_AB_1、ES-09805-1_AC_1（footer Logo）、GK20284_MARKUP_B（REVISION 表图片 (670.94,166.19)-(838.11,296.0)）。

### D4（扫描图方框未整框抹除）——根因确认

因果链（逐环证据）：

1. 纯栅格扫描图（1C4957_H：整页底图 area_frac=1.0、drawings=5；ABB01：drawings=0）：整页底图被面积占比 ≥0.5 过滤（正确，防整页误删）。
2. OCR 命中 CONFIDENTIAL / Fisher Controls（如 1C4957_H (86.14,68.06)-(166.48,86.07)）。
3. `box_finder._extract_grid` 仅提取**矢量 drawings 线段**，扫描图框线是栅格像素 → 提取不到 → FALLBACK → 不自动执行 → 输出保留原文（1C4957_H 输出整页 OCR 仍识别出免责声明段与 FISHER 字样；GK23637_B 的 'FISHER CONTROLS BAO'AN' 区域 mean_diff=0.00）。
4. **排除"只抹文字不抹框"假设**：5 个已自动执行的 boxed OCR 框（AA01_ge21166 等）输出区域 white=1.000、OCR 零残留——自动执行的框抹除干净。用户所述"只抹了 confidential"最合理解释：OCR 检测框只圈出 CONFIDENTIAL 文字行（小框），方框其余内容未覆盖；在 FALLBACK 语境下表现为整体保留。

### 修复方向建议（历史参考，已于下方修复实施记录闭环）

| 项 | 推荐主线 | 备选/风险 |
|---|---|---|
| D3 | 实现宪法"标题栏/边框区图片区域先验自动高置信命中"：页眉/页脚/边框带内的图片自动执行 | 必须先解决 R1（PART NUMBER 表误抹）：区域先验+内容验证（对图片区域做 OCR 词表核对）或用户白名单 |
| D3 配套 | rule_engine 增加"词条前缀/去标点归一"匹配（'EMERSON' 命中 'Emerson Process Management' 首词） | 误报风险，须以区域先验兜底 |
| D4 | box_finder 增加**栅格框线检测**（cv2 边缘/霍夫/轮廓）→ 扫描图方框可归位 → 整框自动执行 | 新功能，工作量中等；检测阈值需样本验证 |
| D4 备选 | 纯栅格页 OCR 敏感框放宽自动执行（去 FALLBACK） | **违反宪法安全阀，不推荐**；仅用户明确决策后可考虑 |

### R1：待用户确认（历史参考，用户已确认误抹，防误抹已生效）

- ES-09708-1_AB_1 右上 PART NUMBER 表图片 (945,27)-(1161,447)（零件号选择表，OCR 识别 'PARTNUMBER'/'ES-09708-1~17'）位于边框区，已被自动执行抹除（boxed=True）。"边框区图片自动高置信命中"若无内容验证，会继续误抹此类正常图纸内容。**该表是否属于不应抹除的图纸内容，需用户确认**。

## D3/D4 修复实施记录（2026-08-17，用户确认方向后实施）

用户确认：R1=误抹应保护；D3=按推荐主线（含内容验证防误抹）；D4=实施栅格框线检测。

实际实施采用了**内容验证主线**（比"区域先验"更稳，见 T3）：区域先验无法区分 Logo 与 PART NUMBER 表，内容验证天然覆盖两者——验证命中补漏自动执行（D3）、验证未命中降级待人工（R1 防误抹），无需区域假设。

### 改动清单

| 文件 | 改动 |
|---|---|
| `core/detector/image_verify.py` | 新增：对无文字支撑的图片 MergedHit 渲染 crop（200dpi，inset 2pt）→ RapidOCR → match_image 判别 token 核对 |
| `core/detector/rule_engine.py` | 新增 `discriminator_tokens`/`image_tokens`/`match_image`：词表条目分词剔除通用停用词（process/management/controls/company/usa/kentucky/inc 等）→ OCR token 交集命中（解决词表粒度错配） |
| `core/pipeline.py` | 集成验证：命中 → boxed=True 补漏执行（terms 追加证据 token）；未命中（含 OCR 不可用）→ 强制降级待人工防误抹；`image_verify=False` 时整体跳过（保持 box_finder 原结果） |
| `core/boxing/box_finder.py` | D4：矢量格线 <8 条时启用 `_extract_grid_raster`（150dpi 渲染 + 行/列投影实心段，密度 ≥0.9、厚度 ≤3pt、长度 ≥12pt）→ 全局归位；失败后 `_snap_raster_box` 局部边扫描（每边候选由远到近组合，宽高 ≤20x 命中框） |
| `tests/` | +16 个测试（rule_engine 判别 token、image_verify 5 路径、pipeline 集成 3 场景、box_finder 栅格 3 场景） |

### 修复轮测试发现并修复的缺陷

1. `pipeline.process` 的 `verified` 在 `image_verify=False` 时未定义（UnboundLocalError 隐患）→ 初始化 `{}` 且验证相关逻辑整体受 `self._image_verify` 保护。
2. 降级循环脱离 `image_verify` 保护：关闭验证时仍把格内图片强制降级待人工 → 已移入保护块内（关闭验证=保持 box_finder 原归位语义）。

### 验收证据

- pytest：46 passed（含新测试全部覆盖上述路径）。
- 全量回归 31 样本 147.9s：文本层零命中 PASS、像素级视觉 PASS。
- D3 定向：ES-09708-1_AB_1/ES-09805-1_AC_1 页脚 Logo boxed=True terms=['emerson','louisville']，渲染 ink 0.127→0.000。
- R1 定向：PART NUMBER 表降级 manual，渲染 ink 0.106→0.106（零变化）。
- D4 定向：13b3422/1C4957_H/AB01/AA01 由全 manual（无输出）转全部自动执行；ABB01 3 manual→1 manual。
- 目检图：`outputs/acceptance/views/crops/ES09708_logo_before/after.png`、`ES09708_pn_before/after.png`（供人工抽查）。

## D8 行级收缩 + ES-09805 相邻行保护实施记录（2026-08-17）

### D8 行级收缩（用户授权，交接后实施，见 `shrink.py` 头部注释）

- 背景：框线归位把敏感框扩大到整个表格单元格，格内非敏感内容（图纸编号、材料规格等）被整格连坐抹除。
- 规则：单元格内仅含文字命中时，抹除框收缩为"全部关联命中的 source_box 并集 + padding(2pt)"；命中面积 > 单元格 70% 或含图片命中保持整格；FALLBACK 不收缩。
- 同期改动：`ui/main_window.py` 改"一键脱敏"（用户授权自动执行全部敏感命中含待人工项，confirm_box_ids 传全部 manual）；`rules/sensitive_terms.txt` 扩充（FISHER、MARSHALLTOWN、PROPRIETARY、RESTRICTED、DO NOT COPY、SECRET 等）；`box_finder` 合并框归位失败拆回逐命中行独立归位。

### ES-09805 回归修复（本轮，相邻行保护）

- **现象**：全量回归 ES-09805-1_AC_1 visual FAIL，box#0 band_removed=0.052、box#2 band_removed=0.063（阈值 0.05）。
- **因果链**（证据闭合）：
  1. 免责声明块行距 0.21pt（span bbox 701.2 vs 收缩框下缘 700.99）；
  2. MuPDF 字形渲染超出 span bbox 上缘 ~1.2pt（渲染实测：字形墨迹 700.0 起 vs bbox 701.2 起）；
  3. 执行第二阶段 full 框（图像像素化用完整框）按默认"相交即删文字"（`PDF_REDACT_TEXT` 仅 remove/none 两档，无"完全包含才删"）删除与 full 框相交的整字符；
  4. 相邻行 'A SUBSIDIARY OF EMERSON...' 中间段（x 725.6-792.7 与收缩框 x 吻合）整字符被删 → 框外污染（文本层：SUBSIDIARY 在、EMERSON 消失）。
- **修复**：`shrink_boxes_to_hits` 新增 `spans`/`tol` 参数与 `_touches_foreign_span`——收缩候选框外扩 3.5pt 容差带内存在"非命中关联"的矢量 span 时放弃收缩（保持整格，安全优先）；`pipeline` 提取页面全部 span 传入（`_page_spans`）；`Box.grow` 新增。纯栅格/OCR 场景无矢量 span、图像按像素处理框外不动，无此问题。
- **验证**：ES-09805 重跑视觉全部 PASS（band_removed 0.011/0.011/0.011/0.006），四框三收缩回退整格；pytest 71 passed；全量回归 163.1s 全绿。

## UI 轮实施记录（2026-08-17，人工确认执行通道 + PyQt5 界面）

### 人工确认执行通道（core 层，跨入口共享语义）

- `RedactBox.box_id`：每个抹除框唯一标识（8 hex），audit JSON 同步输出。
- `Pipeline.redact_result(result, mode, output, audit_path, confirm_box_ids)`：对已检测 FileResult 执行抹除；执行集 = boxed 框 ∪ confirm_box_ids 中显式确认的 manual 框（**未确认的待人工框不得执行，宪法锚定**）。
- `process_and_redact` 重构为 `process` + `redact_result` 组合（CLI 行为不变）。

### PyQt5 界面（ui/）

- `main_ui.py` 入口；`ui/main_window.py` 主窗口：
  - 打开 PDF（QFileDialog）→ 检测走 QThread（不阻塞界面，含错误态）。
  - 命中清单表格（状态/页/框坐标/词条/通道），行色：红=待人工、蓝=已确认。
  - 页面渲染（150dpi 上限 1200px 宽）+ 框叠加（绿=自动执行、红=待人工、蓝=已确认、黄=选中），选中行自动跳页。
  - "确认执行选中项"→ 蓝框；"执行脱敏并输出"→ redact_result（默认输出=源文件名 _desensitized.pdf，audit=_desensitized_audit.json 同目录）。
- smoke 测试 3 个（offscreen）：检测填充/确认+执行全链路（含输出文本抹净断言）/渲染非空。

### 环境修复（阻断）：PyQt5 与 onnxruntime 的 VC runtime DLL 冲突

- 现象：`import PyQt5` 后再 `import onnxruntime` → `DLL load failed while importing onnxruntime_pybind11_state`；UI 进程中 OCR 通道不可用（仅 CLI 无 PyQt5 时正常）。
- 根因：PyQt5/Qt5/bin 自带 VC runtime 14.26（旧），System32 为 14.50（新）。PyQt5 导入把 Qt5/bin 加入 DLL 搜索路径，onnxruntime 依赖的 vcruntime140_1 等命中旧副本 → 初始化失败。
- 修复：将 System32 新版 6 个 runtime DLL（vcruntime140/140_1、msvcp140/140_1/140_2、concrt140）覆盖到 PyQt5/Qt5/bin（旧副本备份于 `%TEMP%\pyqt5_runtime_backup`，pip 重装可还原）。验证：PyQt5→onnxruntime 顺序导入正常、ui_screenshot 真实 OCR 流程无警告。
- 后续打包（PyInstaller）需继承此修复：收集运行时 DLL 时须保证版本 ≥14.30（onnxruntime 1.28 依赖）且全链路一致。

## 命令速查

```powershell
# 全量回归（验收第一/二重证据）
python scripts\regression_acceptance.py
# 单文件处理（CLI）
python main.py "Testing Drawings\GK11040_B.pdf" --output "outputs\acceptance\GK11040_B_desensitized.pdf" --audit out.json
# 单文件像素验收（--mode cover 可选）
python scripts\verify_visual.py <src> <out> <audit.json> [--mode erase|cover]
# 图形界面（人工目检 + 确认执行待人工项）
python main_ui.py
# UI 截图（offscreen，供验收/文档）
python scripts\ui_screenshot.py <input.pdf> <out.png>
```

## 禁止触碰（宪法红线）

- 恢复 FALLBACK 自动执行 / 敏感词硬编码 / 增加 DXF/DWG、联网、深度学习 inpainting、全图盲搜通道。
- 修改 AGENTS.md 宪法、核心 API 契约、词表合同语义、输出命名规则（需用户确认）。
- 客户原始图纸进入文档/日志/交付物（测试样本除外）。