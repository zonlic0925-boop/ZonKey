# Project Status（项目状态）

> 更新于：2026-08-26（ZonScale 现代化 UI + exe 打包 + 多语言）。命令与结果均为本次实际执行。

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
python -m PyInstaller --noconfirm packaging\windows\config\DocumentRules.spec  # exe（可选）
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