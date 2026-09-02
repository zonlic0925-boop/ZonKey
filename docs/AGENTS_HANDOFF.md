# Agents Handoff（交接文本）

> 可直接复制本文件给下一位 agent。更新每次会话结束/轮次切换时。本版更新于 2026-09-02（第十一轮：发布前全面更名 ZonKey + ToolKnit 残留清洗 + 手机端红条改信息条 + 仓库公开化，EXE+Pages 已交付）。
> 配套进度细节见 [PROJECT_STATUS.md](PROJECT_STATUS.md)；工具整合明细见 [INTEGRATION_PLAN.md](INTEGRATION_PLAN.md)；iLovePDF 对齐计划见 [ILOVEPDF_INTEGRATION_PLAN.md](ILOVEPDF_INTEGRATION_PLAN.md)。

## 〇、2026-09-02 第十一轮（发布前全面更名 ZonKey + 公开化收尾，本轮）

- **任务**：① 全项目更名 ZonScale → ZonKey（含 ToolKnit 信息全部替换为 ZonKey、软件名、GitHub 仓库、部署网站）；② 用户确认可公开；③ 移除 `temp_ui_test/selfsign_demo` 证书与 `手机端访问地址.txt` 的 git 跟踪；④ 手机端红条按「信息条代替告警条」改造。
- **更名落地（源码）**：`frontend/src/lib/toolknit/` → `frontend/src/lib/zonkey/`（19 文件，41 处 import 全部更新）；全部「移植自 ToolKnit / 语义对齐 ToolKnit」源码注释改为自述功能描述；i18n 三语「ToolKnit 工具正在按阶段接入」泛化为「该中心的工具正在按阶段接入统一工作台」；`docs/TOOLKNIT_INTEGRATION_PLAN.md` → `docs/INTEGRATION_PLAN.md`（实现来源列改为仓库内真实路径，全文档清洗）。全仓 ZonScale/Zonscale/zonscale/ZONSCALE 文本替换为 ZonKey/zonkey（含 localStorage 键 `zonkey-theme` 等、`core/brand.py`、`desktop_app.py` 的 `%APPDATA%/ZonKey/webview_data`、bat/sh/command 脚本、README、docs、tests、temp_ui_test 调试脚本——**全仓 `git grep -in "toolknit\|zonscale"` 零命中**）。文件名：`build_zonkey_exe.bat`/`build_zonkey_mac.sh`、`ZonKey.spec`×2、`generate_zonkey_icon.py`、`zonkey-icon.svg`、`zonkey.ico/png`×3、npm 包名 `zonkey-ui`。注意 spec 文件被 `.gitignore` 的 `*.spec` 排除在版本控制外，改的是工作区文件。
- **更名落地（外部）**：GitHub 仓库 `Zonscale` → `ZonKey`（gh repo rename，重定向自动生效），描述更新为「ZonKey · 本地离线日用百宝箱 | 智能脱敏为核心 + PDF/PPT/图像/音视频/文本/计算/系统 8 大中心 70+ 工具 | 零联网」，homepage=zonkey.pages.dev，**可见性已按用户确认设为 public**；本地 origin 已改 `github.com/zonlic0925-boop/ZonKey.git`。Cloudflare Pages 新建项目 `zonkey`（`wrangler pages project create`），部署后 **https://zonkey.pages.dev** 主域主 chunk `index-BY9xWu87.js` 与本地/zip 三方一致；旧 zonscale.pages.dev 项目保留未动。
- **红条改造**：App.tsx 顶条按 `isShellMode()`（deliver.ts 的 `'pywebview' in window`）分形——桌面壳保持红底 `bg-mem-coral` + WifiOff + `app.backendOffline` 告警（局域网/桌面真实故障信号）；浏览器（Pages/手机直连）改中性信息条 `bg-mem-teal/15` + Info 图标 + 新增 i18n `app.browserModeInfo`（三语：文件只在浏览器处理不上传，需本机引擎的工具用桌面版）。桌面壳判定无异步问题（isShellMode 同步读 window.pywebview）。
- **跟踪移除**：`git rm --cached` 自签证书 2 枚 + `手机端访问地址.txt`（工作区保留——public_tunnel.py 运行时仍会写入），`.gitignore` 补 `temp_ui_test/selfsign_demo/` 与 `手机端访问地址.txt`。
- **验证**：`npm run build` 成功；pytest **133 passed**（--ignore tests/test_native_dialog.py，native dialog 陷阱）；`release_acceptance.py` 全过（EXE 构建内跑）。EXE 重打包 `dist_release/ZonKey_Windows_x64_20260902.zip`（15:18，覆盖当日旧包）：zip 内 `_internal/dist_web/assets/index-BY9xWu87.js` 含 ZonKey×34、browserModeInfo×4、ZonScale×0；woff2=27；ZonKey.exe PYZ 流扫描 ZonKey×5（`ZonKey 脱敏工作台`入口/`APPDATA/ZonKey/webview_data`）、ZonScale×0。Pages 部署 97c37aac（branch=main），主 chunk 哈希 = 本地 = zip。
- **接手注意**：① 更名是**全仓语义替换**，后续新代码统一用 ZonKey/zonkey 命名（zonkey-localStorage 键、ZonKey.exe、%APPDATA%/ZonKey）；② 公开仓库后 push 前红线审计照旧（无厂商词/无客户文件/无密钥）；③ 旧 EXE 包 `dist_release/ZonScale_*.zip` 仍在本地未删——发布清理时用户拍板去留；④ zonscale.pages.dev 旧项目未删（域名变更后旧链接 404 由新域接管，是否删除项目等用户确认）；⑤ 用户手机/浏览器实测红条新样式 + GitHub 公开页面待确认；⑥ EXE 内嵌前端与 Pages 均为本轮新前端（index-BY9xWu87.js 三方一致）。

## 〇、2026-09-02 第十轮（页面整理编辑文字白屏卡死 + 崩溃后打不开，本轮）

- **现象**：用户实测 PDF 工坊「页面整理」：编辑文字就白屏卡死；之后软件无法再打开。智能脱敏功能全部正常。
- **根因一（白屏卡死，前端）**：`PdfEditorCanvas.tsx` 文字元素 `onBlur={(e) => setElements(els => els.map(... e.currentTarget.innerText ...))}`。React 18 批处理在事件处理器**返回之后**才执行 setElements 的 updater，此时事件对象已被回收（`currentTarget=null`）→ 读它必抛 `TypeError: Cannot read properties of null (reading 'innerText')`，且发生在**渲染器 reducer 阶段** → React 把整棵树卸掉（实测 body.innerHTML 只剩 87 字节）= 白屏卡死，页面永远无法自恢复。Playwright 全栈复现（`temp_ui_test/round10_stack.mjs` 抓到了完整 stack）。
- **根因二（次要，同组件）**：文字元素 fontSize 用了不存在的 `imageMetrics.scale`（imageLayout 只有 scaleX/scaleY）→ NaN 警告。
- **根因三（崩溃后打不开，壳层）**：pywebview 6.x 的 WebView2 用户数据目录默认**全局共享** `%APPDATA%/pywebview`（`platforms/winforms.py::init_storage` 实证）。宿主崩溃/强杀后残留的僵尸 `msedgewebview2.exe` 持有该目录 Singleton Lock → 新实例开窗即白屏，且表现为「崩溃后无法重新打开软件」。实测本机当时就有 5 个残留进程。
- **修复（前端）**：① onBlur 改经 `textRefs` ref 表读节点文本，节点丢失时保底保留原 `el.text`，**绝不抛异常**（事件对象不再进 updater）；② fontSize 改 `(imageMetrics.scaleY || 1)`；③ 新增 `ZsErrorBoundary`（common/，含「重试当前页面」出口），App.tsx 视图层包裹、`resetKey={center:tool}` 切工具自动恢复——任何渲染期异常不再整树卸载白屏；④ `PdfEditorCanvas` 拖动/缩放元素期间给 `<html data-canvas-gesture>`（与 CanvasViewport 同款纵深防御，防拖到标题栏被劫持成移窗口）。
- **修复（壳层）**：`desktop_app.py` ① WebView2 UDF 改 ZonKey 专属目录（`%APPDATA%/ZonKey/webview_data`，经 `webview.start(storage_path=...)`——**注意 settings 表无此键，写 settings 会 KeyError**）；② 新增 `_cleanup_orphan_webview2()`：启动前用 CIM 查 msedgewebview2 的父子关系，**只杀父进程已死的孤儿**（taskkill /T），绝不碰其他应用/浏览器的 WebView2——本机 PanGPA/WhatsApp 的 WebView2 实测不被误伤。
- **验证**：Playwright 修复前复现（pageerror 全栈 + 白屏 body 2 子节点）→ 修复后：`round10_diag.mjs` **16/16**（源码断言×12 + 运行时×4）；`round10_pdfcenter_smoke.mjs` **PDF 工坊 24 工具全功能最小冒烟 72/72 全绿、零 pageerror**（页面整理编辑文字闭环/编辑/合并/拆分/提取/旋转/裁剪/页码/转图片/图转PDF/水印/加密/解密/压缩/增强/在线填表/证书签名 + 转换8工具，后端产物真实落 output/：docx/pptx/压缩/修复/OCR txt）；pytest **133 passed**；release_acceptance 全过；npm build 成功。
- **交付**：EXE `dist_release/ZonKey_Windows_x64_20260902.zip`（12:07）——zip 内 `_internal/dist_web` 43 文件与本地 md5 逐一一致、主 chunk `index-C_aZsxzU.js` 含 ErrorBoundary 文案/scaleY 兜底/ref 保底 blur 压缩特征；PYZ/CArchive 指纹：`desktop_app` code object co_names 含 `_cleanup_orphan_webview2`、`_open_pywebview` 常量含 `storage_path`/`APPDATA`/`ZonKey`/`webview_data`、清理函数常量含 `msedgewebview2.exe`/`ParentProcessId`/powershell。Pages 部署 38c1c3e5（branch=main），主域主 chunk md5 = 本地 = zip（2dcb6d12…）。
- **接手注意**：① contentEditable/任何 DOM 事件的异步回写**禁止在 setState updater 里读 e.currentTarget**——事件对象生命周期只到处理器返回；用 ref 表 + 保底值；② 全应用任何新视图异常现在会被 ZsErrorBoundary 圈住，白屏只剩 ErrorBoundary 自己抛错这一条（改它时注意别引入异常路径）；③ 壳层「打不开」再报时：先看 `%APPDATA%/ZonKey/webview_data` 锁 + 残留 msedgewebview2（新 _cleanup 已自动清，若 UDF 撞其他 pywebview 应用已不可能）；④ smoke 脚本依赖后端 8765 + vite 5199，跑法见脚本头注释；⑤ 用户 EXE 实测闭环仍待确认（页面整理文字编辑 + 全部 24 工具）。

## 〇-0-1、2026-09-02 第九轮（矮窗可达性修复，上轮）

- **现象**：用户实测图纸脱敏左栏在多命中/矮窗口时底部「执行脱敏」按钮被挤出视口且无滚动通道，点不到。
- **根因**：`DrawingView.tsx` 底部操作区 `flex-1 + lg:overflow-visible`——不可压缩也不滚动，与候选列表平分高度后溢出被列 `overflow-hidden` 裁切。
- **修复**：操作区 `shrink-0 max-lg:min-h-0 max-lg:overflow-y-auto`（恒可达，极矮窗口身开滚），候选列表 `flex-1` 独占伸缩；删除无布局作用的 `lg:contents` 包裹层。**同型排查**一并修：`DocPdfView.tsx` 底部操作区 `shrink-0`；`RuleCenter.tsx` 根 `overflow-y-auto xl:overflow-hidden` + 两卡 xl 以下自滚；`AppearanceModal` / `SupportAuthorModal` 弹窗 `max-h-[88dvh] overflow-y-auto`。
- **滚轮横滚**：Header 桌面中心导航窄窗折叠出横向滚动后，Chromium 不把竖向滚轮 delta 转横向——鼠标用户够不到右侧项。修复：`onWheel` 处理器（`|deltaY|>|deltaX|` → `scrollLeft += deltaY`）+ `.zs-wheel-x` 类（`overscroll-behavior-x: contain`，触控板不受影响）。
- **验证**：新 `temp_ui_test/round9_diag.mjs` **16/16**（源码断言×10 + 运行时×6：矮窗 700px 按钮不裁切、RuleCenter 窄屏可达、弹窗极矮窗不超视口、滚轮转横滚、零 pageerror）；round7_diag 极性断言订正为「无反转残留 + _write_flate 在位」（对齐 round-8 真结论）后通过；npm build 成功。
- **交付**：EXE `dist_release/ZonKey_Windows_x64_20260902.zip`（zip 内 dist_web 与本地 md5 一致 + `zs-wheel-x`/`shrink-0 max-lg:min-h-0` 特征串命中）；Pages 部署 be2d0749（branch=main），主域主 chunk `index-Db29cAmr.js` = 本地 = zip。
- **接手注意**：① 底部操作区/弹窗类组件新增时遵循「操作区 `shrink-0`、内容区 `flex-1` 伸缩、弹窗 `max-h-[88dvh]` 内滚」约定，别再让按钮进伸缩区；② 纯横向滚动容器要接竖向滚轮一律用 `.zs-wheel-x` + onWheel 模式；③ RuleCenter 后端离线时渲染早退卡，主布局可达性断言靠 round9_diag 源码断言兜底，后端在线场景待实测；④ 31 样本回归与 round-8 扫描件两样本用户实测仍开放。

## 〇-0、2026-09-02 第八轮（脱敏输出整页全黑——双层根因修复，上轮）

- **现象**：用户对 1C4957_H.PDF（CCITT G4 扫描图纸）执行脱敏，输出 PDF **整页全黑**、仅白色脱敏条可见（截图确认）；round-7 修复后新复现。
- **根因一（极性反转迁就坏夹具）**：round-7 的测试夹具 `make_ccitt_scan_pdf` 本身极性反了（PIL mode "1" 0=黑 → G4 TIFF 按 min-is-white 0=白 编码存盘时位流翻转 → 夹具按直觉填 PIL 白底(1)，PDF（BlackIs1=False 0=黑）渲染出**黑底白块**，夹具作者未发现）。为让回归通过，round-7 在 `_write_image_stream` 加了「CCITT 解码后整体反转极性」来迁就坏夹具——而**真实扫描件解码极性正常**（实测 1C4957 角点=255 白），被统一反转后白底变黑底 → 全黑页。脱敏条是后画矢量填充所以独白。
- **根因二（Flate 回写声明失配，影响所有原始样本分支，本轮新发现）**：pikepdf `stream.write(data)` **存裸数据不压缩**（`filter=` 参数语义是「数据已按此滤镜编码」而非「帮我压缩」，pikepdf 10.12 实测）；`_write_image_stream` 各分支写裸样本后声明 `Filter=/FlateDecode`——声明与数据不符，渲染器解压失败**整图作废**（round-7 修 fromarray 后手动复现：位流全白仍渲染全黑即此因）。1bpc/L/RGB/CMYK 分支全部损坏；旧 RGB 测试能过是坏图被渲染跳过、采样点落在矢量白填充上的侥幸。JPEG 分支正确（JPEG 字节本就是已编码数据）。
- **修复**（`core/redact/pikepdf_engine.py`）：① 删除极性反转——PIL 0=黑/255=白 与 PDF 1bpc 样本 0=黑/1=白、pikepdf 解码极性与 PDF 渲染极性**双重天然一致**，直接重打包即保真；② 新增 `_write_flate(obj, data)`——`zlib.compress(data, 6)` 后再 write + 声明 FlateDecode，is_mask/1bpc/L/CMYK/RGB 五分支全部收口。
- **夹具与回归强化**（`tests/pdf_helpers.py` + `tests/test_executor.py`）：夹具改按「编码后位流=PDF 约定白底」填 PIL 0 底 + 1 矩形（渲染白底黑块，与真实扫描件一致，docstring 写透极性陷阱）；端到端测试补**框外背景保持白**（全黑回归旧断言测不出）+**框外墨线保留**（防「整图填白」假修复）双向断言；单测升级**极性保真逐位校验**（左黑右白图案回写解包比对，任何再引入整体反转/压缩失配的改动即挂）。
- **验证**：pytest **133 passed**；release_acceptance 全过；**真实样本端到端**：1C4957_H.PDF 脱敏后五点采样全白（左下灰点=扫描原始纸张噪点，与源逐像素一致）、渲染目检图纸完整仅 CONFIDENTIAL 标题条被抹（`temp_ui_test/round8_ccitt_fixed_preview.png` / `round8_ccitt_fixed_sample.pdf`）。
- **交付**：EXE 重打包（dist_release）+ Pages 部署，按指纹法核验。
- **接手注意**：① **1 位图极性禁止整体反转**——两重天然一致是实证结论（真实件+合成件双实测），不是理论推导；② **pikepdf write() 永远存裸数据**，任何「原始样本回写」必须先 zlib.compress（`_write_flate` 已收口，新分支勿绕过）；③ 坏夹具诱导的「补偿修复」是本轮事故链起点——测试样本渲染结果与真实语义不符时先修夹具再谈引擎；④ 外观纹理标签墨块问题 round-7 已修（.zs-texture overlay 类禁复用），用户本轮确认解决。
- **第七轮订正**：该轮 round-7 修复描述中的「极性反转」与「Image.fromarray」方案已被本轮取代（fromarray 修复本身正确——TiffImageFile 确无类方法 fromarray——但其后的极性反转是错的）。

## 〇-0-2、2026-09-01 第七轮（用户实测 2 问题修复）

- **① 问题2 脱敏全失效——系统识别与手动框选同报「图像像素化失败…TiffImageFile has no attribute 'fromarray'」（真 bug，Phase M 起就坏）**：触发条件是 **CCITTFaxDecode 1 位传真扫描图**（工程图纸扫描件的标准格式，用户两样本 AA01_1K4168_A.pdf / 1C4957_H.PDF 均是）——pikepdf 对 CCITT 走 TIFF 包装解码，`as_pil_image()` 返回 `PIL.TiffImagePlugin.TiffImageFile`；`_write_image_stream` 做 CCITT 极性反转时写的是 `pil.__class__.fromarray(...)`，**TiffImageFile 类（以及 Image.Image 类本身）根本没有 fromarray**（它是 PIL.Image 模块级函数），AttributeError 被 round-6 的防御包装成「拒绝静默保留敏感图像内容」拒绝执行。git 考古：该行 Phase M（ee25339）引入，pikepdf 引擎上线起扫描件像素化从未成功过。修复：`core/redact/pikepdf_engine.py` 改模块级 `Image.fromarray`（函数内局部导入，合文件风格）。回归双保险：`test_executor.py` 新增 ①端到端 `test_ccitt_scan_pixelated_after_erase`（pdf_helpers 新增 `make_ccitt_scan_pdf`：PIL G4 TIFF 提条带 → 手拼 CCITTFaxDecode PDF，脱敏后深色块区域全白断言）②单测 `test_write_image_stream_accepts_tiff_image_file`（真 TiffImageFile 直灌 `_write_image_stream`）。**两用例在修复前代码上实测复现 AttributeError、修复后通过**（stash 验证法）。
- **② 问题3 外观纹理标签字体异常（渲染成墨块/图章状，真 bug）**：现象只有纹理行 5 个标签花、同弹窗其他同款 10px 粗体标签（界面字号行）正常。**根因**：`AppearanceModal.tsx` 预览 span 复用了 `.zs-texture`——那是**全页 overlay 定位类**（`position:absolute; inset:0`，App.tsx 页面纹理层专用），预览块被绝对定位铺满**整个按钮**垫到文字底下；Chromium/WebView2 对**压在 background-image 上的 10px 粗体中文**走劣化光栅路径，笔画粘连成墨块。定位法（可复用）：计算样式逐项 diff 为零 + CDP `getPlatformFontsForNode` 两边都是 MicrosoftYaHei-Bold 仍复现 → 唯一关联是「标签下有无 zs-texture 背景图兄弟」（纯色档无图案类所以一直干净）；实验矩阵（重绘/禁动画/改字号/改字重/搬位置/克隆互换）证明伪象**跟随节点**而非样式。修复：预览 span 只挂图案类（`zs-texture-grid/dots/paper/fluid-preview`），不再挂 `.zs-texture`——`block h-8 rounded` 本身就是 32px 文档流色块，图案类只管 background-image；App.tsx 全页层用法不动。
- **验证**：pytest **133 passed**（131+2 CCITT 新用例）；npm build 成功；新 `temp_ui_test/round7_diag.mjs` **15/15**（引擎源码断言×2 + 外观源码断言 + 5 标签×运行时几何（预览 static/零重叠）+ 零 pageerror）；round6_diag **9/9** 回归；round5/theme_drag 未动不再重跑（不受影响面）。
- **交付**：**EXE 重打包**（`dist_release/ZonKey_Windows_x64_20260901.zip`）+ **Pages 部署**，三方一致：zip 内 `_internal/dist_web/assets/index-IBiqWJA6.js` = 本地 dist_web = 线上 zonkey.pages.dev；**round-7 前端指纹**：旧拼接串 `zs-texture zs-texture-fluid-preview` 在 bundle 中消失（修复前任何包都有）+ `zs-texture-fluid-preview`/`zs-texture-grid` 在 + woff2×27；**PYZ 指纹（co_names 法新用例）**：`_write_image_stream` code object 的 `co_names` 含 `PIL`/`Image`/`fromarray`（修复前该函数不引用全局 Image）——`CArchiveReader(exe).extract('PYZ.pyz')` → `ZlibArchiveReader.extract('core.redact.pikepdf_engine')`。证据截图 `temp_ui_test/appearance_texture_fixed.png`。
- **接手注意**：① 扫描件脱敏闭环需**用户 EXE 实测**两样本（AA01_1K4168_A / 1C4957_H），渲染目检抹除块不越框（验收三重证据之 2）；② `zs-texture` 是**全页 overlay 专用定位类**，任何卡片内预览/小色块组件**禁止复用**，只要图案类；③ 10px 粗体中文**避免压在 background-image 上**（WebView2 劣化光栅），小字标签给纯色底；④ 若用户再报同类「字体不正常」，先用 CDP getPlatformFontsForNode 排除字体选择问题，再看兄弟层背景图叠加；⑤ 旧 EXE 用户报「脱敏无法执行…fromarray」即未升级，报错文案未变可作版本指纹。

## 〇-0-1、2026-09-01 第六轮（用户实测 3 问题修复，上轮）

- **① 问题1 引擎状态条文字竖条（真 bug，非字体）**：用户提供放大截图（`temp_ui_test/rules_chip_zoom.png`）——「20 规则」左侧引擎文字被压成 ~14px 宽竖条逐字换行裁切。根因是布局挤压：桌面行中列收缩后状态条自身 `min-w-0`，引擎文字 span `overflow-hidden` 无宽度底线，被挤到亚字形宽度。修复：`Header.tsx` 引擎文字 span 加 `min-w-[76px]`（≈4 个中文字宽），压缩到 76px 后才省略号。1024px 窄窗实测文字仍 ≥76px 可读。
- **② 问题2 方框拖动劫持（真根因锁定，三轮 CSS 修复失效的答案）**：**pywebview 6.2.1 默认 `easy_drag=True`**——frameless+edgechromium 下它向页面注入 **window 级 mousedown 拖窗器**（`webview/js/customize.js`：任意位置按下+移动 → `pywebviewMoveWindow`），画布上拖方框/缩放必被转成移窗口，**完全绕过 WebView2 app-region 命中与 `data-canvas-gesture` 手势标记**——这就是 round-3/4 CSS 层修复（class 驱动 + !important 翻转都真实生效）却仍复现的原因：劫持根本不走 app-region 路径。修复：`desktop_app.py` `create_window(..., easy_drag=False)` 一行拔掉整条劫持路径；窗口拖动只剩 Header 品牌行 `app-region: drag` 一条正路（WebView2 非客户区支持），即用户要求的「拖动范围限制在标题栏、像正常软件」。⚠️ 回归脚本断言不了壳内真实鼠标路径，**用户 EXE 实测确认**是闭环条件。
- **③ 问题3 手动框选脱敏 HTTP 500（多层防御 + 留痕）**：TestClient 复现矩阵（A-H + 多页/旋转/公文模式）确认裸 500 触发条件：**手动框 `page_index` 越界（>最大页/负数）→ `RedactError: 页号越界` 未捕获冒泡**。另两路隐患一并修：① `server_bridge.py` execute-redaction 捕 `RedactError` → 可读 400「脱敏无法执行：页号越界…」；② 新增 `_log_engine_error()` 落 `engine_error.log`（壳内窗口化 EXE stdout 被吞、FastAPI traceback 用户侧不可见，正是「顽固」表象的诊断盲区），PDF 抹除/zip 导出/预览渲染/Word 脱敏全链路留痕；③ `_build_redact_boxes_from_selection` 输入防御：null/NaN/负宽高/零面积坐标归一或拒绝（负宽高=拖动翻转，归一为合法矩形继续执行）；④ `_resolve_output_dir` 加写探针，目录不可写（U 盘拔出）自动回退默认 `output/`；⑤ Word 端点同口径加固。
- **验证**：pytest **131 passed**（127+4，新增 `test_redact_box_overrides.py` round-6 四用例：越界页 400/负宽高归一/零面积拒绝/目录回退）；`npm run build` 成功；UI 回归 `theme_drag_check.mjs` **31/31**、`round5_diag.mjs` **16/16**；新 `temp_ui_test/round6_diag.mjs` **9/9**（芯片 min-w 宽度/溢出策略/窄窗/easy_drag 静态断言/后端防御特征串）；desktop_app.py & server_bridge.py import 冒烟 OK；release_acceptance 全过。
- **交付**：**EXE 重打包**（`dist_release/ZonKey_Windows_x64_20260901.zip`，PE 时间戳 22:01）+ **Pages 部署**。核验：zip 内 `_internal/dist_web/assets/index-CkKyymwk.js` 与本地 md5 一致、CSS 含 `min-width:76px`、woff2×27；PYZ 内 server_bridge 四特征（_log_engine_error/engine_error.log/.zs_write_probe/脱敏无法执行）命中、CArchive desktop_app 含 easy_drag kwarg；线上 `zonkey.pages.dev` 主 chunk md5 = 本地、live CSS 含修复。
- **接手注意**：① 拖动劫持若在最新 EXE 仍复现（概率极低），下一步查 `frameless_window.py` Win32 钩子层 WM_NCHITTEST 兜底返回值，但 easy_drag 已关、app-region 命中路径应独立成立；② PYZ/CArchive 特征验证法：`PyInstaller.archive.readers.CArchiveReader/ZlibArchiveReader`，kwarg 名（如 easy_drag）在 **co_consts 的 tuple** 里不在 co_names，明文 grep 恒 False 别误判；③ 引擎异常日志在**仓库根/EXE 同级 `engine_error.log`**，用户再报 500 先看它；④ 手动框零面积（用户误点）现在返回 400「未选中任何脱敏项」属预期，不算回归；⑤ vite dev 测试跑法不变（port 5199），round6_diag 走 vite dev、round5_diag 走 dist_web 静态 8902。

## 〇-0-0、2026-09-01 第五轮（用户实测 3 问题排查修复，上轮）

- **① 问题2 字体匹配（实机验证，无 bug）**：引擎条计算样式 `"DM Sans", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`、外观面板标题 Audiowide、`document.fonts` **27 faces 全本地加载**、CSS 零 Google Fonts CDN 引用——round-4 @fontsource 链路健康。**用户所见字体回退来自旧发布包**：实证 `dist_release/ZonKey_Windows_x64_20260831.zip` 内 `dist_web/assets/*.woff2` **为 0**（旧包未带字体），20260901 包已带 27 个。结论：确认用户用最新包即可，无需代码改动。
- **② 问题3 纹理预览修复（真 bug）**：`AppearanceModal.tsx` 预览块内联 `style={{ background: 'rgb(var(--mem-cream))' }}`——`background` 简写会把 class 的 `background-image` 一并重置为 none（内联优先级压过样式表），4 个纹理档预览全显示为同色纯块 → 用户「切换无感知」。修复：改 `backgroundColor`（只设底色不碰 image）。**主体接线本来就通**（切档 → `zs-texture-*`/`zs-fluid` 层真实渲染，round-4 的默认 fluid 与新访客渲染层断言均 PASS）。
- **③ 问题4 白屏卡死（浏览器/软渲染端排除，壳环境加固）**：Playwright `--disable-gpu`（软件 raster）首帧挂载 **203ms 零 pageerror**、fluid 层正常——浏览器端无白屏路径。指向 EXE 环境的两项加固：**(a) 移除 `.zs-fluid-blob` 的 `filter: blur(72px)`**——radial-gradient 自带 70% 渐隐，blur 纯冗余，却是 WebView2 GPU 受限/老驱动下大半径模糊层 **GPU 进程挂死源**（开窗即白屏卡死的头号嫌疑），移除零观感损失；**(b) desktop_app.py 三处确定性缺陷修复**——`_log` 原只捕 `UnicodeEncodeError`，窗口化 EXE（`console=False`，sys.stdout=None）任何 print 都 TypeError（现捕 Exception）；失败路径 `input("按 Enter 退出...")` 在无 stdin 时必 `RuntimeError: lost sys.stdin`（新增 `_die()` 统一收口，仅当 stdin 存在才等待）；`webview.start()` 打开失败（WebView2 Runtime 缺失/GPU 崩溃）原本静默白死进程（新增兜底：traceback 留痕 + 退回系统浏览器）。
- **验证**：新增 `temp_ui_test/round5_diag.mjs` **16/16**（首启 root 挂载非白屏/字体链实测/预览块 image 断言/切档渲染/五档映射）；`theme_drag_check.mjs` **31/31**；`gpu_diag.mjs` 软渲染 2/2；npm build 成功；pytest **127 passed**；desktop_app.py import 冒烟 OK。
- **交付**：**EXE 重打包** + **Pages 部署**（本收尾轮次，按指纹法核验 zip 内 index.html/CSS 与本地一致）。
- **接手注意**：① 白屏卡死若最新包仍复现：请用户提供 `startup_error.log`（EXE 同级目录，新 `_die`/兜底已确保留痕）+ WebView2 Runtime 版本；② 后续 UI 改动**禁止**在预览块/任何元素上用 `background` 简写叠加 class 的 `background-image`（要底色用 `backgroundColor`）；③ `.zs-fluid-blob` 现在无 blur，若未来恢复模糊请先评估 WebView2 软渲染风险；④ 20260831 及更早 EXE 缺 woff2，用户报字体问题先查包内 `_internal/dist_web/assets/*.woff2` 数量。

## 〇-0-0、2026-09-01 第四轮（用户实测 4 问题修复，上轮）

- **① 方框拖动劫持根治（round-3 修复为何失效）**：round-3 的 `html[data-canvas-gesture] [data-drag-row]` 覆盖规则是**死代码**——Header 拖拽行用内联 `style={appRegion:'drag'}`（Header.tsx dragRowStyle），内联样式优先级压过任何样式表规则，手势期转 no-drag 从未生效。修复：拖拽行改 **class 驱动**（`.zs-drag-row`，index.css `@layer components`），手势覆盖规则加 `!important`（含子元素通配 `[data-drag-row] *` 双保险）。回归升级：`theme_drag_check.mjs` 现断言 **getComputedStyle 的 app-region 真实翻转**（旧断言只查属性存在，死代码也 PASS——这是漏检根因）。
- **②③ 字体离线化（引擎条/外观面板字体不显示的根因）**：`index.css:1` 原来走 Google Fonts CDN `@import`，离线 EXE 静默 404 回退系统字体。修复：**@fontsource 自托管**（dm-sans/space-grotesk/audiowide/caveat，全部 OFL 宽松许可，符合零 AGPL 政策），只引入实际用到的字重（DM Sans 400-700 / Space Grotesk 500-700 / Audiowide 400 / Caveat 500,600）；tailwind fontFamily 加 **CJK 回退链**（Microsoft YaHei / PingFang SC），离线下中文不缺字形。npm warning：@fontsource 包通过 npm install 正常安装无需 allow-scripts。
- **④ 纹理可感知化 + 流动默认化/重设计**：静态纹理 alpha 提升（grid 0.05→0.11 / dots 0.07→0.16 / paper 0.025→0.07，旧值肉眼不可见）；**fluid 重设计**——旧版 135-180s 一循环 + opacity 0.4 看不出在动，新版 26-42s 错相循环 / opacity 0.5-0.68 / blob 40-56vw / blur 72px，blob 从 3 改 3 个（a/b/d，lavender 换 pink 色位）；**fluid 设为默认纹理**（themeCore.loadTexture 默认 'fluid'，无 localStorage 偏好时生效，显式选过「纯色」的用户不受影响）；desktop_app.py save_ui_prefs texture 默认值同步 'fluid'。
- **验证**：`theme_drag_check.mjs` **31/31**（新增：拖拽行计算样式=drag / 手势期 no-drag 翻转 / class 驱动断言 / CSS 零 CDN 引用 / 四款字体本地加载 / 新访客默认 fluid 渲染层断言）；`homenav_fav_flow.mjs` 14/14；npm build 成功（woff2 字体进 assets，CSS 零 fonts.googleapis 引用）；pytest **127 passed**；release_acceptance 全过。
- **交付**：**Pages 已部署**（线上主 chunk = `index-DCPRlCxW.js` 含 zs-drag-row 特征串，CSS = `index-D-tG7_4J.css` 零 CDN 引用 + zs-fluid-drift-d 在线）；**EXE 重打包**见 dist_release（打包后须按指纹法验证：zip 内 `_internal/dist_web/assets/index-DCPRlCxW.js` + woff2 字体文件存在）。
- **接手注意**：① 方框拖动劫持的壳内真实鼠标验证仍需用户实测（Playwright 无法复现 WebView2 手势接管路径，但本轮计算样式断言已证明 CSS 层修复生效——round-3 是死代码层失效，本轮 class+!important 层真实翻转）；② `document.fonts.check` 只对已加载 face 返回 true，页面未用到的字重（如 Caveat 600）须先 `fonts.load` 再断言——测试脚本已按字重子集+显式 load 处理；③ 默认纹理不写 localStorage（无偏好=不落盘），断言默认值要看渲染层（`.zs-fluid-blob` 存在）而非 `localStorage.getItem`；④ 拖拽行今后只用 `zs-drag-row` class + `data-drag-row` 属性，**禁止再写内联 app-region 样式**。

## 〇-0-0-1、2026-09-01 第三轮（用户实测 5 问题修复）
- **① 引擎状态条被窗口按钮遮挡**：`pr-[150px]` 原本只在 shellMode 生效，且中列不可收缩时状态条被挤进按钮区。修复：桌面行**恒定** `pr-[150px]` + 中列 `min-w-0` 可收缩 + 中心导航窄窗横向滚动（`zs-hide-scrollbar`）+ 状态条文字 ellipsis。回归断言：状态条右缘 ≤ 窗宽-148（实测 1290 ≤ 1292 @1440）。
- **② 方框拖动变拖窗口（根因升级）**：`app-region` 命中是**逐消息判定**的（Electron/Chromium 同源语义）——方框拖动手势进行中指针滑入 Header drag 行（0-80px），WebView2 把同一手势接管成拖窗口且不归还。上轮静态几何修复覆盖不了这个动态场景。修复：CanvasViewport 在 `editingId`（拖动/缩放）或 `isDrawing`（手动画框）时给 `<html>` 设 `data-canvas-gesture`，CSS `html[data-canvas-gesture] [data-drag-row]` 整行转 no-drag，手势结束（pointerup/cancel/unmount）自动恢复。零 React 重渲染，纯属性切换。
- **③ 品牌重定位「日用百宝箱」**：`i18n brand.workbenchBadge`（脱敏工作台→日用百宝箱）+ `brand.subtitle`（列 8 中心能力）+ `meta.pageTitle` 三语齐；`core/brand.py` APP_TITLE/HTML_TITLE 同步。脱敏仍是核心能力，叙事覆盖全工具。
- **④ 外观字号档**：新增 `FontSizeId`（sm 15px/md 16px/lg 17.5px/xl 19px）——`<html data-fontsize>` + 内联 `style.fontSize` 驱动全站 rem 等比缩放，localStorage `zonkey-fontsize` 持久化，index.html 防闪屏脚本同步回放。AppearanceModal 加「界面字号」4 档（A 字号预览）。手机端 17.5px 媒体查询在用户显式选择时被内联样式覆盖（优先级正确）。
- **⑤ 流动背景**：新增 `FluidBackground.tsx`（3 个 radial-gradient blob，blur(80px) 固定，只动 transform/opacity，135-180s 超慢 ease-in-out 循环，颜色走主题变量）；animate skill 规范判定：纯氛围动效 → reduced-motion **完全静止**（非放缓）。纹理档扩为 5 档（none/grid/dots/paper/**fluid**），ui_prefs 加 `font_size` 字段。
- **验证**：`theme_drag_check.mjs` **25/25**（新增字号/流动/引擎条/手势标记断言）；`homenav_fav_flow.mjs` 14/14；npm build 成功；pytest **127 passed**；release_acceptance 全过。
- **交付**：EXE 已重打包（`dist_release/ZonKey_Windows_x64_20260901.zip` 14:24，内嵌前端指纹验证：`index-DZ96rTiz.js` 含 data-canvas-gesture ×4 + 日用百宝箱 ×2，CSS 含 zs-fluid ×12，legacy chunk 齐，PyInstaller 因 brand.py/desktop_app.py 变更重建 PYZ/PKG）；Pages 已部署（当轮线上主 chunk = `index-DZ96rTiz.js`，**已被第四轮部署取代**，现线上 = `index-DCPRlCxW.js`）。
- **接手注意**：① 方框拖动劫持修复依赖壳内真实鼠标验证（Playwright 无法复现 WebView2 手势接管路径）——用户实测若仍复现，下一步是查 `frameless_window.py` 窗体层兜底 WM_NCHITTEST 是否在 WebView2 层之外额外返回 HTCAPTION；② 拖拽行现在由 `data-drag-row` 属性标记（非 class），查找时用属性选择器；③ EXE 闪屏底色主题联动、字号持久化在壳内均走 localStorage + ui_prefs.json 双通道。

## 〇-0-1、2026-09-01 第二轮（主题/外观系统 + 拖拽层重构）

- **主题系统上线**：`tailwind.config.js` mem-* 色板挂 CSS 变量（`rgb(var(--x) / <alpha-value>)` 保住 `/30` 透明度语法）；`index.css` 定义 4 套 `data-theme` 预设——`cream`（默认）/ `paper`（素白）/ `slate`（冷灰）/ `dark`（深底浅描边）。**`white` 语义归一到 `--mem-surface`**：61 处 `bg-white` 卡片深色下自动翻转，`text-white` 全部落在强调色底上已核对可读（AuditView/RuleCenterModal 两个 glass 风格文件是无 import 的孤儿组件，不构成风险）。换主题 = `<html data-theme>` 一个属性，组件类名零改动。
- **ThemeProvider**：`frontend/src/lib/theme/`（themeCore.ts 纯函数 + ThemeProvider.tsx context）；localStorage `zonkey-theme` / `zonkey-texture`；`index.html` 内联脚本在 React 挂载前回放 `data-theme`（防闪屏）。
- **背景纹理二级选项**：`none/grid/dots/paper` 纯 CSS（无资产），App 根容器 `zs-texture` 层渲染，跟随 ink 变量。
- **外观选择 UI**：`AppearanceModal.tsx`（主题缩略预览 4 卡 + 纹理 4 档，即点即换即存）；入口 ×2——Header（桌面品牌行 + 手机顶栏，调色板图标）+ HomeNav 快捷入口（第 4 个 quick link）；i18n `appearance.*` 三语齐。
- **拖拽层重构（评估结论：根因是覆盖条几何手工复刻，离线横幅下压 Header 时必然错位 + 右侧 132px 魔法数字）**：删除 `WindowDragStrip.tsx`，改为 **Header 品牌行自身 `app-region: drag`**（桌面 h-20 行 / 手机紧凑顶栏），行内交互组（品牌+外观+隐私+支持+语言/导航/状态条）保持 `.no-drag` 豁免。实测 Playwright：离线横幅把 Header 下推 43px 时拖拽行**跟随对齐**（旧方案会钉死 0-80 错位）——这是新结构的直接实证优势。导航结构（home-nav 落地页/SubNav 回首页）维持不动。
- **壳层闪屏联动**：前端 ThemeProvider 经 `window.pywebview.api.save_ui_prefs({theme,texture})` 镜像到 `<app_root>/ui_prefs.json`；`desktop_app.py::_load_shell_bg()` 在 `create_window` 前读取设置 `background_color`（THEME_SHELL_BG 映射表与 `themeCore.ts` 同表，**两处必须同步改**）。损坏/缺失/键非法一律回退 cream。实测 round-trip：save(dark) → 文件 → `#181826`。
- **MemphisDecor**：硬编码 hex 全部改 mem-* 变量类/SVG stroke 类；加缓漂浮 CSS 动画（transform only，`prefers-reduced-motion` 关闭）。
- **验证**：`npm run build` 成功（30.2s）；新回归 `temp_ui_test/theme_drag_check.mjs` **17/17**（主题即点即换/持久化/防闪屏回放/纹理/拖拽几何桌面+手机/零 pageerror）；上轮 `homenav_fav_flow.mjs` **14/14**（脚本端口改为 localhost——本机 vite 6 默认绑 IPv6，127.0.0.1 拒连）；pytest **127 passed**；release_acceptance 全过；ui_prefs round-trip OK。
- **接手注意**：① **EXE 已重打包**（2026-09-01，`dist_release/ZonKey_Windows_x64_20260901.zip`）——内嵌前端经指纹法验证 = 本轮构建（`index-B556ldtk.js` 三方一致 + `zs-texture-grid` 特征串 + 主题文案），PyInstaller 日志确认 `desktop_app.py changed` 触发 PKG 重建（ui_prefs 闪屏联动已进包）；release acceptance 全过；② **Pages 已部署本轮构建**（生产 branch=main，线上主 chunk = `index-B556ldtk.js` = 本地，线上内容含主题特征串）；③ 拖拽行内新增交互元素时只需给它 `.no-drag`，不要再建覆盖条；④ 主题切换过渡用 `.zs-theme-root` 类（App 根容器），新顶层容器记得带上；⑤ **用户固定工作流（2026-09-01 明确）：每轮完成任务后必须重打包 EXE + 部署 Pages**，已写入 agent memory。

## 〇-0-1、2026-09-01 第一轮（首页导航 + 收藏闭环 + 壳层交互修复）

- **用户反馈 4 项处置**：①最大化要点两下=已修；②内容区拖动被窗口拖拽劫持（图纸方框拖不动）=已修；③「没有出现」=EXE 内是旧前端（上轮手机导航/收藏是 Pages 部署，EXE 未重打包），**下轮跑一次 `build_zonkey_exe.bat` 即带上**；④另一项无问题。
- **① 最大化双击修复**：`desktop_app.py::toggle_maximize` 改为按 Win32 `IsZoomed` 实时状态切换最大化/还原（旧实现只会 maximize，前端轮询缓存滞后时第一次点击落错分支）；前端 `WindowControls.tsx` 统一走 `toggle_maximize` + 点击后 120ms 即时查 `is_maximized` 刷新图标。壳内实测三连击状态机 PASS（`temp_ui_test/shell_smoke2.py`，结果落 `shell_smoke_result.txt`）。
- **② 拖拽劫持修复**：`WindowDragStrip.tsx` 旧版是 fixed 全宽 40px 覆盖条，内容滚动进顶部 40px 即被 WebView2 转 HTCAPTION 拖窗口。现改为**两条 Header 品牌行高度（桌面 80px/手机 56px）的 drag 层**，交互区（品牌标/隐私/支持/语言/中心导航/状态条）加 `.no-drag` 豁免（`index.css` 新增类）；几何实测 drag 条 0-80px、SubNav 91px 起、工具卡 97px 起，零重叠。⚠️ Playwright 合成点击会被 drag 层拦截（真实鼠标不受影响，no-drag 元素正常）——UI 测试对 header 区按钮用 `dispatchEvent('click')`。
- **首页导航页**：新增虚拟工具 `home-nav`（types RedactToolId），**应用默认落地页**改为它（App.tsx 初始态）。`navigation/HomeNavView.tsx`：8 中心分类卡（ready/total 计数不虚报）+ 我的收藏 chip 区（有收藏才显示）+ 快捷入口（规则/审计/收藏页）。SubNav 行加「首页」回跳按钮（任何中心可见，首页自身隐藏）；home-nav 视图下 SubNav 整条隐藏。手机底部导航 home tab 语义同步改为回首页导航页。
- **收藏闭环**：`SubNavPills` 新增 `trailingSlot`，当前工具星标内联显示在 redact 中心 SubNav 行（`FavoriteStar` 支持 className 覆盖定位）；PDF 工坊首页卡片星标（已有）+ 首页收藏区 + 收藏页（已有）三入口互通。壳模拟实测：星标→localStorage→首页 chip→点击直达工具全链路 PASS。
- **动效基建**：`main.tsx` 包 `MotionConfig reducedMotion="user"`（系统减动效设置全app生效）；App.tsx 主视图切 `pageFadeSlide` 容器（key=中心:工具触发淡入）；HomeNavView 用既有 `staggerContainer/staggerItem` + Memphis 卡片 hover 微动。全部 transform/opacity，零新依赖。
- **i18n**：`homeNav.*` 5 键三语（zh-CN/zh-TW/en）齐。
- **验证**：`npm run build` 成功；Playwright `temp_ui_test/homenav_fav_flow.mjs` **14/14**（桌面 1440 + 手机 390 双视口：落地页/分类卡/跳转/收藏显示/收藏直达/零溢出/零 pageerror）；`dragstrip_check6.mjs` 几何 OK；`subnav_star_check3.mjs` OK；壳层烟测 OK；pytest **127 passed**（--ignore native dialog）。
- **主题调研（只调研未动代码）**：`docs/THEME_BACKGROUND_RESEARCH.md`——推荐 CSS 变量主题层方案（tailwind mem 色板变量化 + 4 预设含深色），开放问题：是否要深色模式/背景纹理，待用户拍板。
- **接手注意**：① EXE 仍带旧前端（2026-08-31 版），重打包才有首页导航+收藏+本轮修复；② Pages 也未部署本轮构建，部署命令见 memory（`npm run build` 后 wrangler/pages 上传 dist_web）；③ HomeNavView 落地后 `redact` 中心默认工具仍记忆 `drawing`，从外部直达 redact 中心的行为不变。

## 〇-1、2026-08-31 深夜后续（无边框壳两处致命 bug 修复，实机全绿）

- **① GUI 线程死锁（上一轮遗留，必现挂死）**：`frameless_window.py` 最初从 attach 线程直接枚举 `native_form.Controls` / 轮询 `CoreWebView2`，COM 互操作在非 STA 线程上把 GUI 线程卡死（`IsHungAppWindow=True`，实测复现）。修复：所有 CLR 访问经 `native_form.BeginInvoke(System.Action)` 排到 GUI 线程；`CoreWebView2` 不轮询，改订阅 `CoreWebView2InitializationCompleted` 事件回调里一次性设 `IsNonClientRegionSupportEnabled=True`（Tauri 同款：CSS `app-region: drag` → 原生拖拽/Snap/双击最大化）。
- **② 最大化遮任务栏**：仅靠 `WM_GETMINMAXINFO` 钩子会被 DWM 隐形边框外扩 ~11px（最大化 client 实测盖到任务栏）。修复：`WM_NCCALCSIZE` 钩子里当 `IsZoomed` 时把客户区内缩到 `_monitor_workarea`（Chromium frameless 同款）+ BeginInvoke 设 `Form.MaximizedBounds=WorkingArea` 双保险。
- **附加修正**：64 位下 `SetWindowLongPtrW` 必须显式声明 `argtypes/restype`（否则窗口过程指针溢出 OverflowError）；`IntPtr` 转换用 `.ToInt64()`；`wintypes` 无 `MONITORINFO`（自定义 `_MONITORINFO`）。
- **实机验证（Win32 消息级 + 壳内 evaluate_js 端到端）**：钩子安装后 `IsHungAppWindow=False`；命中测试 top=HTTOP/left=HTLEFT/center=HTCLIENT；右上 3 个自绘按钮渲染且 `pywebview.api` 桥接 OK；最小化→WindowState 1、最大化→2 且 client==workarea(0,0,2560,1528)、还原→0；浏览器模式（Playwright）`.zs-win-ctrl` 不渲染、零 pageerror。pytest 127 passed + release_acceptance 全过。
- **给下一位**：EXE 打包后仍需人工双击确认真实鼠标拖拽/边缘缩放手感（消息级测试无法覆盖 WebView2 鼠标路径）；若拖拽带无响应，优先查 `zonkey.frameless` logger 里 `webview_nonclient=True` 是否出现。诊断脚本留存：`/tmp/zs_probe9.py`（钩子+nonclient）、`/tmp/zs_final_verify.py`（按钮状态机）。

## 〇、2026-08-31 深夜（手机端导航 + 收藏 + 无边框桌面壳，已部署 Pages）

- **手机端底部导航**（`navigation/MobileBottomNav.tsx`）：5 tab = 收藏 / 首页 / 智能脱敏 / PDF 工坊 / 更多（弹层列全部中心）。仅移动视口渲染，桌面零影响。tab 命中区 ≥44px。
- **工具收藏**：`lib/zonkey/favoritesCore.ts`（localStorage，上限 12，跨中心，change 事件同步）+ `FavoriteStar.tsx`（PdfToolHome 卡片星标）+ `FavoritesView.tsx`（redact 中心虚拟 tool `favorites-view`：跳转/取消/空态）。
- **真 bug 修复 ×2**：① 上会话遗留 App.tsx JSX 片段闭合错乱（TS1381 构建失败）；② 底部 tab 切收藏只切 tool 不切 center，非 redact 中心下落「功能维护中」占位符——现在先 `handleCenterChange('redact')` 再切。
- **桌面壳无边框窗口**：`core/frameless_window.py` + `WindowControls.tsx` + `WindowDragStrip.tsx` + `desktop_app.py` 改造（自绘标题栏/最小化/最大化/关闭）。
- **验证**：Playwright 390×844 实机（`temp_ui_test/mobile_nav_check.mjs` / `mobile_fav_flow.mjs`，截图 `shots_mnav/`）：收藏全链路 + 三页横向溢出=0 + 零 pageerror；impeccable detect.mjs 0 findings；npm build 成功；pytest 127 passed（注意：后台跑 pytest 时 shell cwd 会漂到 frontend 导致 "no tests ran"，必须确认在仓库根执行）；Pages 已部署且线上=本地（`index-SPDzCuv0.js`）。
- **接手注意**：EXE 下轮打包会自动带上本轮前端（后端仅 desktop_app.py 无边框改造，需实机开一次确认拖拽/按钮正常）。

## 2026-08-31 晚（转换工具浏览器引擎兜底，线上已部署）

- **需求背景**：用户要求「桌面版有的功能，网页版尽最大可能复刻；做不了的提醒只能桌面端」（网页版轻量引流 + 桌面版重能力）。
- **新前端引擎 `frontend/src/lib/zonkey/convertWebCore.ts`**：后端离线（公网 Pages/手机）时自动降级浏览器本地处理，文件零上传。7/8 工具可兜底：
  - pdf-to-word：PDF.js 文本行（字号/粗体/坐标聚类）→ docx.js 重建（标题分级/分页；复杂表格线性化，如实标注）；
  - pdf-to-excel：行聚类 + x 间隙分列 → SheetJS（每页一 sheet；无框线检测，简化口径）；
  - pdf-to-ppt：PDF.js 逐页渲染贴图 → pptxgenjs（与后端同思路）；
  - office-to-pdf：docx→mammoth→HTML、xlsx→SheetJS→HTML → 栅格化 → pdf-lib（.doc/.xls 旧格式引导桌面版）；
  - html-to-pdf：Markdown/HTML 子集解析 → 栅格化（与后端同语义子集）；
  - compress-deep：逐页栅格化 + JPEG 重编码 → pdf-lib（无文本层，与后端同语义）；
  - pdf-repair：pdf-lib 容错解析重建（尽力而为）；
  - **ocr-export 浏览器做不了**（OCR 模型过大）：诚实显示「此工具需要本机引擎」引导桌面版，不虚标。
- **ConvertView 接线**：capability 探测失败 → `webFallback` 自动启用（UI 无任何布局变化）；顶部蓝条如实标注「浏览器本地引擎 + 保真度低于桌面版」；产物走 `deliver.downloadBlob` 统一出口（壳内=服务端中转另存为，浏览器=直接下载）；成功后显示引擎标识 + 重新下载按钮。
- **许可合规（零 AGPL）**：docx@9.7.1 MIT / xlsx@0.18.5 Apache-2.0 / pptxgenjs@4.0.1 MIT / mammoth@1.12.2 BSD-2 / html2canvas@1.4.1 MIT / pdf-lib MIT（已有）。重量级依赖全部动态 import() 分 chunk（pptxgen 282KB / xlsx 430KB 独立 chunk 不进主包）。
- **关键坑（重做一次的教训）**：foreignObject data-URL SVG 栅格化在 Chrome 上报「The source image cannot be decoded」（100% 复现，dev 与产物一致）——**首版用 foreignObject 方案在实机测试全挂**，换 html2canvas 逐节点重绘后解决，foreignObject 仅作加载失败的回退。教训：栅格化 HTML 一律 html2canvas 起步。
- **实机验证（Playwright，dev server + 后端离线场景，`temp_ui_test/webconvert_final.mjs`）**：6/6 通过——pdf-to-word（PK/docx 8.6KB）、pdf-to-excel（PK/xlsx 16KB）、compress-deep（%PDF/30KB）、pdf-to-ppt（PK/pptx 119KB）、html-to-pdf（%PDF/9.4KB 中文加粗正常）、ocr-export 桌面引导正确显示。产物 magic bytes 全部正确。
- **验证三绿**：`npm run build` 成功（32.8s）；pytest `--ignore=tests/test_native_dialog.py` → **127 passed**（后端零改动）；`zonkey.pages.dev` 已部署新构建（`index-CBxmc5sG.js` 含引擎特征串，HTTP 200）。
- **手机导航坑（测试脚本层面，非产品 bug）**：1280px 视口下 Header 中心按钮组溢出隐藏，Playwright `button[title="PDF 工坊"]` 解析到隐藏节点超时——UI 测试须用 `:visible` 选择器 + ≥1366px 视口。
- **尚未做（接手顺序建议）**：
  1. 手机真机体验浏览器转换（Playwright 已过，真机 Safari/微信 X5 未测——html2canvas 老内核兼容性待观察）；
  2. EXE 无需重打包（后端零改动），下轮打包时自然带上新前端；
  3. 31 样本回归仍开放（样本目录未到位）。

## 2026-08-31 收尾轮（P3 安全工具 + P4 收尾 + 打包/部署，已提交）

- **工作树干净**：`git status` 无未提交变更；master 最新提交 `e80eb98`（20:36，6 笔提交一次收尾）。文档（本文件 + PROJECT_STATUS.md）在收尾轮内最后更新并另行提交，若接手时工作树出现这两文件变更即属正常。
- **P3 安全工具全链路（已提交 `33a91ea` 后端 / `838776d` 前端 / `67ff56c` 测试）**：
  - 权限保护 Protect PDF：pikepdf 全量加密（用户权限位 + 口令），`/api/security/protect`；
  - 证书签名 Cert Sign：pyHanko 真 PAdES 签名（`/api/security/pades-sign`），自签证书/私钥上传 UI（PEM）已修好，`/api/security/verify` 验签；
  - 同源 API 路径修正、mainboard/bios 渲染、cleanup 加载态、i18n 三语补键；
  - 测试 `tests/test_p3_security_tools.py`（143 行：protect 权限位 + pades 真签真验 + verify 断言）+ `tests/test_p4_gates.py`（42 行：cleanup 端点结构 + convert capability 键）。
- **P4 收尾（已提交 `7fc07e0` / `e33aa2e`）**：PDF 中心导航分组（组织/转换/编辑/安全）+ 工具首页宫格；系统清理端点 `/api/system/cleanup/status`（监控 output + temp_bridge_files，门禁 `cleanup_endpoints` 断言）。
- **桌面复测完成**：`temp_ui_test/full_feature_test*.mjs`（MODE=mobile|desktop）覆盖 8 中心 76 工具 + 导航 + 隐私弹窗 + 横向溢出，产物 `temp_ui_test/shots_full/`；本轮含最后一笔 UI 微调（CanvasViewport 移动端把手/按钮区 `zs-touch-target-mobile` 等）。
- **Phase 9 完成（EXE 重打包）**：`dist_release/ZonKey_Windows_x64_20260831.zip`（20:29，~280MB，3776 条目）。**已验证内嵌前端 = 当前构建**：`_internal/dist_web/assets/index-BP5sWohB.js` 与根 `dist_web/` 及线上 Pages 资产哈希完全一致（含最后一笔提交的特征串）。
- **Phase 10 完成（Pages 部署）**：生产 `zonkey.pages.dev` 已部署（wrangler 直传，非 Git 集成），线上资产 = 本地 `dist_web/`；`curl` 200 + 0.30s。
- **三道验证全绿（2026-08-31 复核）**：
  - `pytest -q --ignore=tests/test_native_dialog.py` → **127 passed**（33.8s，唯一告警为 Starlette httpx 弃用提示，可忽略）；
  - `python scripts/release_acceptance.py` → 全部通过（exe_exists / synthetic_pipeline 零残留 / no_agpl_components / cleanup_endpoints / convert_capability_gate / generic_terms_in_rules）；
  - 线上 URL `https://zonkey.pages.dev` → HTTP 200。
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
- **验证证据**：`tests/test_convert_tools.py` 22 用例（新增 9）；全量 `pytest -q --ignore=tests/test_native_dialog.py` → **121 passed**（原 112 + 新 9）；`npm run build` 成功（21.6s）；Cloudflare Pages 已重新部署（zonkey.pages.dev）——线上仅纯前端能力，转换工具显示后端离线属预期边界。
- **尚未做（接手顺序建议）**：
  1. 浏览器级 UI 实测轮（已跑通，跳过单页拆分与下载断言异常）：P0/P1 的 14 个 PDF 工具 + 新转换 8 工具 + 脱敏全链路（Phase M 后首确保真）一起补；
  2. 31 样本回归（`Testing Drawings\` 样本到位后跑 `scripts/regression_acceptance.py`）；
  3. **工作树大量未提交变更**（P2 两轮 + Phase M 全部，含 EXE 重打包产物路径），建议用户过目后择机分批提交；
  4. 之后才是 P3（编辑/表单/签名）与 P4 收尾（导航重组、清理端点、门禁增列）。

## 2026-08-30 下午（Phase M：PyMuPDF 退出迁移，未提交）

- **AGPL 清零完成，发布门禁新增 `no_agpl_components` 断言全绿，EXE 已重打包**（PyInstaller 重建 + `dist_release/ZonKey_Windows_x64_20260830.zip`）。PyMuPDF 已从 requirements.txt 除名并卸载，全仓 `import fitz` 归零（含 11 个测试文件、3 个脚本、temp_ui_test/make_samples.py）。
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
- 工具接线：**55 ready / 5 planned**（余：视频转码、视频转 GIF、色彩空间对比、离线转写、打字测速）。

## 一、项目一句话定位

**ZonKey**（by zonlic）：本地离线脱敏工作台（公开发布版），读入 PDF 工程图纸/公文 PDF/Word，在框线约束内抹除用户自配敏感词/Logo/保密标记，输出 `原名_desensitized` 副本，不改原始文件。技术栈 React + FastAPI 桥 + pywebview 桌面壳，核心引擎在 `core/`。宪法、红线、兄弟仓库关系见根目录 [AGENTS.md](../AGENTS.md)，**先读它再动手**。

## 二、当前状态（TL;DR）

- **60 项工具整合已完成并收尾**（收尾提交 `5c80508`，2026-08-29 08:47）。
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
  - 核心：`frontend/src/lib/zonkey/pdfCore.ts` + `pdfRender.ts`（PDF.js + cryptpdf AES-256）；视图 `frontend/src/components/pdfcenter/` 五个新组件。
  - 新依赖：`pdfjs-dist`、`cryptpdf`（`frontend/package.json`）。
  - `cd frontend && npm run build` → **成功**（2607 modules；pdf.worker 单独 chunk；主包 ~1.96MB gzip 658KB）。

## 三、已确认技术路线（不得更改）

- **脱敏引擎宪法**：输入只接受 PDF（DXF/DWG 已否定）；禁联网/云脱敏、禁深度学习 inpainting、禁全图盲搜；FALLBACK 无框归位不得自动执行；图片内容验证（crop OCR → `match_image` 判别 token）未命中强制降级待人工防误抹；敏感词只走 `rules/sensitive_terms.txt` 外部词表，代码零硬编码。
- **发布版红线**：`rules/` 仅通用保密词；禁止内置 Fisher/Emerson/TopWorx/MKS 厂商规则与 Logo（公司内建版在 `Desktop/experiment/Desensitization`，两仓库 UI/打包/规则真源完全分离）。
- **前端栈**：React + TypeScript + Tailwind（Memphis 风格）+ Framer Motion；纯前端工具引擎在 `frontend/src/lib/zonkey/`（12 个 core 模块）；系统硬件走 FastAPI 桥（`server_bridge.py` + `backend_system_tools.py`）。

## 四、用户 UI/工作流硬性偏好（2026-08-29 实测轮核实，动 UI 前必读）

| 偏好 | 状态 | 落点 |
|---|---|---|
| 批量文件先全部载入显示，再从第一张开始识别 | ✅ 上传流已按 preview-first + `preloadPdfPageImages` 实现，改动识别管线时保持此分期 | `components/DrawingView.tsx` |
| 后台识别完成**不得**自动切换/打断用户正在查看的图纸 | ✅ 已实现（仅当无激活文件时才设 activeFileId） | `DrawingView.tsx:174-180` |
| 画布缩放把手小巧精致（~8px 圆点级别），仅选中框显示，命中区保持舒适 | ✅ 已实现（`HANDLE_SIZE=6`，`showHandles` 仅活动框） | `components/CanvasViewport.tsx:30,726-747` |
| EXE/应用图标必须用龙鳞品牌标（标准多尺寸 DIB ICO，防资源管理器回退 Python 图标） | ✅ 已实现（`scripts/generate_zonkey_icon.py` 生成 + PyInstaller 嵌入，rcedit 路线已废弃） | `build_zonkey_exe.bat:52-55,93-94` |

后续任何 UI 改动不得回退以上行为。

## 五、历史债务与开放项

D1-D8 债务、T1-T4 设计取舍、F1/F2 功能需求、修复实施记录、31 样本回归基线——**全部保留在 [PROJECT_STATUS.md](PROJECT_STATUS.md)**，此处不重复。仍开放项：

- D1（OCR 模型上限，人工兜底）、D2（1 框阈值内待目检）、D5（2 处图片验证未命中待人工/白名单决策）；
- D6/D7/D8（待用户实机复验一键模式与行级收缩新行为）。

## 六、下一步

以本文档「〇」节为准（2026-08-31 晚起）：P3/P4/Phase M/P2 均已完成并提交，EXE 与 Pages 已部署，**转换 8 工具已有浏览器引擎兜底并上线**。剩余：手机真机复测浏览器转换 → 31 样本回归（样本到位后跑 `scripts/regression_acceptance.py`）。

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
build_zonkey_exe.bat
```

## 八、禁止触碰（宪法红线）

- 恢复 FALLBACK 自动执行 / 敏感词硬编码 / 增加 DXF/DWG、联网、深度学习 inpainting、全图盲搜通道。
- 修改 AGENTS.md 宪法、核心 API 契约、词表合同语义、输出命名规则（需用户确认）。
- 把任何厂商词/Logo 带入发布版 `rules/` 或代码；客户原始图纸进文档/日志/交付物（测试样本除外）。
- 回退第四节任何一条 UI 偏好。
