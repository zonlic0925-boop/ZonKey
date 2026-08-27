# Agents Handoff（交接文本）

> 可直接复制本文件给下一位 agent。更新每次会话结束/轮次切换时。
> 配套进度细节见 [PROJECT_STATUS.md](PROJECT_STATUS.md)。

## 当前目标与已确认边界

- 项目：本地 PDF 工程图纸脱敏工具（抹除 Fisher/Emerson/TopWorx/MKS 公司名、Logo、CONFIDENTIAL 类标记），输出 `原名_desensitized.pdf`，全程本地离线，不改客户原始文件。
- 当前状态：**交互性与自定义规则增强轮（已完成）**。
  1. 修复了点击「框选手选抹除」时的 AttributeError 闪退（方法名 `set_draw_mode` vs `set_manual_draw_mode` 统一）；
  2. 修复了脱敏完成后对指定区域取消抹除无效的问题（取消抹除或手动增删时，自动撤销当前图纸的脱敏完成状态并实时刷新双视图预览）；
  3. 新增了**用户自定义脱敏规则**管理功能（支持在 UI 中直观添加、删除、持久化规则并热重载检测引擎）；
  4. pytest 78 passed、全量回归 PASS。
- 本期范围：可运行源码（CLI + PyQt5 UI） + 样本回归全绿；PyInstaller 打包为后置阶段。
- 已确认技术路线（不得更改）：
  - 输入只接受 PDF（DXF/DWG 通道被用户明确否定）；禁用联网/云脱敏；禁用深度学习 inpainting；禁用全图盲搜敏感文字。
  - 三通道：矢量文字（PyMuPDF span）、矢量图像（XObject）、OCR（300dpi 渲染 → RapidOCR，MAX_SIDE_PX=4096），统一坐标系 IoU 去重融合。
  - 敏感词走 `rules/sensitive_terms.txt` 外部词表（代码零硬编码）；含编辑距离容错（长词 ≥5 字符、容差 len//8，单词级比较）。
  - box_finder 框线归位：敏感框向上归位到最小封闭表格单元格（矢量格线 + D4 起含栅格像素框线）；无框归位者（FALLBACK）强制"待人工确认"且 **不得自动执行**（宪法硬规则）。
  - **图片内容验证（D3/R1 修复后机制）**：无文字支撑的图片命中做 crop OCR → `rule_engine.match_image` 判别 token 交集；验证命中 → 补漏自动执行；验证未命中（如 PART NUMBER 表）→ 强制降级待人工防误抹；`image_verify=False` 时整体跳过保持 box_finder 原结果。
  - 抹除模式：ERASE（默认，真删除）与 COVER（黑块）可切换；`verify_visual.py` 支持按模式验收。
  - 抹除执行两阶段：字形删除用内缩框（INSET_PT=1.5 保格线），图像像素化用完整框（防贴线文字漏删）。注意：MuPDF `PDF_REDACT_TEXT` 只有 remove/none 两档（无"完全包含才删"），full 框"相交即删文字"是相邻行切字的根源，靠 shrink 相邻行保护规避（见下）。
  - **行级收缩（D8 修复，2026-08-17 用户授权）**：单元格归位框收缩到敏感文字行（`core/boxing/shrink.py`）；**相邻行保护（ES-09805 回归修复，本轮）**：收缩候选框外扩 3.5pt 容差带内存在非命中矢量 span 时放弃收缩保持整格（防 MuPDF 连坐删除相邻行字形，安全优先）。
- 命名规则：`AA01_1K4168_A.pdf` → `AA01_1K4168_A_desensitized.pdf`（`core/redact/executor.py:output_path_for`）。

## 当前 git 状态

- 项目已初始化为 Git 仓库并关联私有远程仓库。
- 客户图纸与敏感数据已通过严格的 `.gitignore` 保护（`Testing Drawings/`、`*.pdf`、`output/` 等全部排除）。

## 已完成工作与验收证据

- **UI 轮（上轮）**：
  - core 人工确认通道：`RedactBox.box_id` + `Pipeline.redact_result(confirm_box_ids=...)`——待人工框必须用户显式确认才执行（宪法锚定）；CLI 行为不变。
  - PyQt5 界面：`python main_ui.py`（打开 PDF → 命中清单 + 页面框色叠加 → 确认待人工项 → 执行输出）；检测走 QThread；默认输出 `原名_desensitized.pdf` + `原名_desensitized_audit.json`。
  - pytest **54 passed**（+3 UI smoke：offscreen 全链路——检测填充/确认/执行输出文本抹净断言/渲染非空）。
  - 环境阻断修复：PyQt5 与 onnxruntime 的 VC runtime DLL 版本冲突（14.26 vs 14.50）→ 已用 System32 新版覆盖 PyQt5/Qt5/bin 副本；修复后真实 OCR 流程无警告。
  - UI 截图：`outputs/acceptance/views/ui_ES09708.png`（ES-09708-1_AB_1 真实检测渲染，供用户目检）。
- **D3/R1/D4 修复轮（上轮验收）**：46→54 passed、回归 147.9s 全绿、Logo ink 0.127→0、PART NUMBER 零变化、扫描图全自动——详见 PROJECT_STATUS.md。
- 早期轮次验收（不回退）：FALLBACK 不自动执行、INSET_PT 保格线、Stamp 清理、两阶段抹除、编辑距离容错均保留。
- **UI 实机验收轮（上轮，只记录）**：用户实机报告 D6/D7/D8 + F1/F2，已登记。
- **F1/F2 功能轮（上轮）**：批量导入/批量检测/批量执行（文件队列面板 + 串行 BatchDetectWorker + per-file 确认集合）+ 前后对比双视图（PreviewView 滑轮缩放重渲染）；pytest 60 passed、回归 189.9s 全绿、截图 `outputs/acceptance/views/ui_batch_preview.png`。
- **D6/D7 证据轮（上轮）**：用户提供两张实机输出 PDF，只读分析收敛根因——`ABB01_18A0644_B_desensitized.pdf` 两框为**纯黑块（COVER 模式产物）**（复现证明 ERASE 对同文件白块正常），`MARSHALLTOWN` 待人工未确认残留（宪法允许）；`1C4957_H_desensitized.PDF` 三框 ERASE 白块残留 0%（正常）。文本层两文件零残留。**D8 无证据，仍待具体案例。**
- **D8 shrink 轮（交接后未记录）**：用户授权实施行级收缩（`shrink.py`）解决"整格连坐抹除格内非敏感内容"；UI 改一键模式（全部敏感命中自动执行，`ui/main_window.py` 注释明示用户授权）；词表扩充（FISHER/MARSHALLTOWN/PROPRIETARY 等）。
- **ES-09805 回归修复轮（本轮）**：D8 shrink 引入视觉 FAIL——行距 <3.2pt 时收缩框与相邻行字形相交，MuPDF full 框"相交即删文字"连坐删除相邻行整字符（band_removed 0.052/0.063 超阈）。修复：shrink 相邻行保护（收缩候选框外扩 3.5pt 带内有非命中矢量 span → 放弃收缩保持整格）；ES-09805 visual FAIL→PASS；pytest **71 passed**、回归 **163.1s 全绿**（文本零命中 PASS / 像素视觉 PASS）。

## 待人工确认清单（CLI/回归路径；UI 一键模式除外）

以下文件的输出 PDF 中**故意保留** FALLBACK/验证未命中项（宪法不允许自动执行）：
- **CLI 路径（main.py）/回归脚本**：不传 confirm_box_ids → 这些框不执行、原样保留（见下表）；
- **UI 一键脱敏模式**：用户已授权自动执行全部敏感命中（含待人工项，`ui/main_window.py` 注释），下表文件在 UI 中会全部执行。

| 文件 | 待人工项 | 备注 |
|---|---|---|
| ES-09708-1_AB_1.pdf | 2 项 | PART NUMBER 表 (945,27)-(1161,447) 验证未命中（R1 防误抹）；左上 (27,27)-(342,255) 图片验证未命中（D5） |
| GK20284_MARKUP_B.pdf | 2 项 | REVISION 表 (670.94,166.19)-(838.11,296.0)（D3 同类）；(798,702)-(927,753) 图片（D5） |
| GK23637_B_ENGLISH_MILLIMETERS.pdf | 2 项 | 待人工确认内容见 audits/GK23637_B_ENGLISH_MILLIMETERS.json |
| ABB01_18A0644_B.pdf | 1 项 | MARSHALLTOWN (346.9,587.03)-(461.07,601.41)，无框归位 FALLBACK |
| GF15457_b.pdf | 1 项 | 见 audits |
| GK11040_B.pdf | 1 项 | TopWorx（其余 3 框已自动） |
| GK11040_C_ENGLISH_MILLIMETERS.pdf | 1 项 | 其余已自动 |
| GK11040_MARKUP_C.pdf | 1 项 | 见 audits |
| GK20284_B_ENGLISH_MILLIMETERS.pdf | 1 项 | 见 audits |
| GK23637_A_ENGLISH_MILLIMETERS.pdf | 1 项 | 见 audits |
| GK23637_Markup_B.pdf | 1 项 | 见 audits |
| GK27585_Markup_B.pdf | 1 项 | 其余已自动 |
| GK33580_A_ENGLISH_MILLIMETERS.pdf | 1 项 | 见 audits（FISHER 待人工，最新回归补登） |

> 相比上一轮：13b3422 / 1C4957_H / AB01_18A0645_C / AA01_1K4168_A 已从全 manual 转为全自动（D4 生效），不再在此列。

## 未闭合风险 / 债务 / 漂移警告

- **债务 D8（部分处理，剩 UI 口径待确认）**：用户实机"误抹图纸其他信息"已按授权实施行级收缩（shrink）+ 本轮相邻行保护（ES-09805 防切字）。**待用户实机复验新行为**：行距近的表格（如免责声明块）整格抹除（保护放弃收缩）、行距充足的保留非敏感行。若仍有误抹案例，需具体文件/区域/内容。
- **债务 D6/D7（已收敛根因，UI 已改一键模式）**：实机文件证据表明用户执行时处于 COVER 黑块模式 + 待人工未确认。UI 已改"一键脱敏"（用户授权全部执行，默认 ERASE 白块），待用户实机复验；"执行前模式确认弹窗"未实施（如用户需要再加）。
- **债务 D1**：AA01_1K4168_A 老扫描图 OCR 将 FISHER 识别为 FISHERO（模型上限），依赖人工复核兜底，不追模型级增强。
- **债务 D2**：GK20284_MARKUP_B 自动执行框 (510,777,798,795) residual 1.07%、std 14.4（阈值内 PASS），留待 UI 目检复查。
- **债务 D5**：ES-09708-1_AB_1 左上 (27,27)-(342,255) 与 GK20284_MARKUP_B (798,702)-(927,753) 图片内容验证未命中 → 降级待人工（保守行为）。需人工确认是否为正常图纸内容；若是，考虑白名单/排除配置（待用户决策）。
- **功能需求 F1/F2**：✅ 已实施。批量：文件队列 + 检测全部 + 批量执行；预览：双视图 + 滑轮缩放重渲染（≤4096px）。待用户实机验收。
- **设计取舍（已记录，非缺陷）**：抹除框与格线共享像素时 MuPDF 切掉极小线段（band_removed ≤ 4%），视觉不可感知，安全优先；D3 用内容验证替代区域先验；COVER 模式输出黑块为设计行为（UI 默认 ERASE）；相邻行保护容差 3.5pt 为启发式（字形渲染溢出 ~1.2pt + padding 2pt + 余量），宁可不收缩不可越框切字。
- **漂移警告**：不得以任何理由恢复 FALLBACK 自动执行；不得绕过 image_verify 内容验证直接按区域先验自动执行图片；不得把敏感词写回代码/词表变更必须走 `rules/`；客户原始图纸数据禁止进文档、日志、交付物。
- **输出编码**：CLI 中文输出在 GBK 控制台乱码（不影响功能）；UI 为 Unicode 正常显示。

## 下一步最安全命令与停止条件

1. ✅ 已完成：
   - 修复手选抹除闪退；
   - 修复脱敏完成后无法修改/取消抹除区域的问题（动态重置状态与渲染）；
   - 新增脱敏规则管理弹窗（支持用户在 UI 中自行增删脱敏词表并实时热重载）；
   - 修复 System32 权限与路径解析；
   - pytest **78 passed**、回归 **163.1s 全绿**。
2. **交接给下一位 Agent 的复验与后续建议**：
   - 启动 UI：`python main_ui.py`
   - 测试点击「✏️ 框选手选抹除」与「⚙️ 管理脱敏规则」；
   - 验收脱敏完成后点击「🗑️ 取消所选抹除」或拖拽手选手选抹除后，是否能立即清空旧脱敏图纸并允许重新执行「⚡ 仅对当前图纸执行脱敏」；
   - 验收添加新敏感词规则后，点击「🔍 重新检测当前图纸」能否按新规则命中敏感信息。
3. 停止条件：所有改动确保通过 `pytest` 与 `python scripts\regression_acceptance.py`。