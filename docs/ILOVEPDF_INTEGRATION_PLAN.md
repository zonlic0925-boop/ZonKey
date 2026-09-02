# iLovePDF 功能对齐接入方案

> 生成日期：2026-08-30。基于对现有 60 个工具的全面审计 + iLovePDF 官方功能清单 + 开源方案调研。
> 结论先行：**架构不用动，缺的是引擎**。现有 PDF center（pdf-lib + PDF.js）、后端 PyMuPDF、任务/交付/能力探测体系全部就绪，接入 iLovePDF 全功能是「补工具」而不是「补架构」。

---

## 1. 现状审计结论

### 1.1 已有底盘（可直接复用）

| 层 | 现状 |
| --- | --- |
| 前端 PDF 引擎 | `frontend/src/lib/zonkey/pdfCore.ts`（pdf-lib + PDF.js + cryptpdf），9 个 PDF 工具已上线 |
| 后端 PDF 引擎 | PyMuPDF 1.27.1（栅格化/脱敏/水印底子）、RapidOCR（脱敏链路内）、opencv |
| Office 转换 | PPT→PDF 已通（LibreOffice 优先 + PowerPoint COM 兜底，含能力探测 `/api/ppt/render/capability`） |
| 异步任务 | `/api/media/jobs/{id}` 进度轮询模式，可直接套用到长时转换 |
| 交付链路 | `lib/deliver.ts` 统一交付（壳内原生另存 / 浏览器流下载），`output/` 目录约定 |
| UI 容器 | SubNavPills 分组导航、CapabilityGate 能力门控均已存在 |

### 1.2 已发现的三处「死资产」（接线即得功能，零新依赖）

1. **JPG→PDF**：`core/converter/image_merge.py:10` 后端实现完整且有测试，但无 API、无 UI。
2. **PDF 水印**：`frontend/src/lib/zonkey/officeCore.ts:122` `addPdfWatermark()` 已实现，零引用。
3. **按页码范围拆分**：`officeCore.ts:15` 有 range 拆分实现，`PdfSplitView` 未用（目前只能逐页拆）。

### 1.3 已知技术债（顺手修）

- `pdfKit.tsx:60` 等处绕过统一交付层用裸 `a[download]`，壳内走的是 WebView2 下载而非 `deliver.ts` 另存路径 → 应统一。
- `requirements.txt` 缺 `pywin32`，`backend_ppt_tools.py:81` 的 PowerPoint COM 兜底在本机静默失效。
- `officeCore.ts` 与 `pdfCore.ts` 功能重叠且无人引用 → 接线水印/拆分后应合并进 `pdfCore` 并删除孤儿代码。

---

## 2. iLovePDF 全功能对照矩阵（26 项）

状态：✅ 已有｜🟡 部分实现｜❌ 缺失。引擎列 = 推荐实现载体（**F**=纯前端，**B**=后端 Python，**C**=外部 COM/二进制）。

| # | iLovePDF 工具 | 状态 | 现状/缺口 | 推荐引擎 | 阶段 |
| --- | --- | --- | --- | --- | --- |
| 1 | Merge PDF | ✅ | `PdfMergeView` | F pdf-lib | — |
| 2 | Split PDF | 🟡 | 仅逐页拆；缺范围/区间 UI | F pdf-lib（officeCore 已有底子） | P0 |
| 3 | Remove pages | ✅ | `PdfEditorView` 删页 | F | — |
| 4 | Extract pages | 🟡 | 无「选中页导出新 PDF」显式入口 | F pdf-lib | P1 |
| 5 | Organize PDF（可视化排序） | 🟡 | 行列表+按钮，无缩略图拖拽 | F PDF.js 缩略图 + 拖拽 | P1 |
| 6 | Rotate PDF | ✅ | 范围表达式 + 90/180/270 | F | — |
| 7 | Compress PDF | 🟡 | 仅对象流重写+去元数据，扫描件无收益 | B pikepdf + pypdfium2 图片重编码降采样（宽松许可组合） | P2 |
| 8 | Repair PDF | ❌ | 无 | B pikepdf（qpdf 内核，损坏恢复） | P2 |
| 9 | PDF→Word | ❌ | 无 | B 自研：pdfplumber 文本/表格抽取 → python-docx 重建（**已定：规避 pdf2docx 的 PyMuPDF 硬依赖**，复杂版式保真度下降，UI 如实标注） | P2 |
| 10 | PDF→PPT | ❌ | 无 | B PyMuPDF 页渲染 + python-pptx 贴图成片 | P2 |
| 11 | PDF→Excel | ❌ | 无 | B **pdfplumber**（MIT）表格抽取→openpyxl | P2 |
| 12 | PDF→JPG | ✅ | PNG/JPEG + ZIP 批量 | F PDF.js | — |
| 13 | Word→PDF | ❌ | 无 | C Word COM（保真）+ 兜底：mammoth→HTML→PyMuPDF Story | P2 |
| 14 | PPT→PDF | ✅ | LibreOffice/COM 双路 | — | — |
| 15 | Excel→PDF | ❌ | 无 | C Excel COM + 兜底 openpyxl→HTML→Story | P2 |
| 16 | JPG→PDF | 🟡 | 后端有实现未接线 | F pdf-lib 直接嵌入 JPEG/PNG（**已定：走前端，img2pdf 为 LGPL 不引入**） | P0 |
| 17 | HTML→PDF | ❌ | 无 | B reportlab platypus + HTML/markdown 子集解析（前端 markdown-it 已有） | P2 |
| 18 | Edit PDF（加文字/图形/批注） | ❌ | 无 | F canvas 覆盖层 + pdf-lib 写注释对象 | P1/P3 |
| 19 | Page numbers | ❌ | 无 | F pdf-lib drawText（位置/字号/格式/起始页） | P1 |
| 20 | Watermark | 🟡 | 实现成孤儿 | F 接线 + 补文字水印/平铺/透明度 | P0 |
| 21 | Crop PDF | ❌ | 无 | F pdf-lib setCropBox | P1 |
| 22 | PDF Forms | 🟡 | 仅复制时拍平表单，无填写/创建 | F pdf-lib getForm 填写；创建字段次之 | P3 |
| 23 | Unlock PDF | ✅ | cryptpdf 解密 | F | — |
| 24 | Protect PDF | ✅ | AES-256；缺权限位 UI | F 补只读/禁打印等权限选项 | P1 |
| 25 | Sign PDF | ❌ | 无（仅印章检测用于脱敏） | F 手绘/键入签名→盖章；证书级用 B **pyHanko**（MIT，PAdES） | P3 |
| 26 | Redact | ✅ 超集 | 本项目主业：框选+OCR 辅助+审计 | — | — |

iLovePDF 还有的长尾（按需跟进）：

| 工具 | 状态 | 方案 |
| --- | --- | --- |
| OCR PDF | ❌ 无用户入口（引擎已有） | B 暴露 RapidOCR：PDF→TXT / sandwich PDF（pypdfium2 渲染 + reportlab 文字层叠加） | P2 |
| Compare PDFs | ❌ | B PyMuPDF 双文本抽取 diff + 渲染叠加图 | P3 |
| Photo Album | ❌ | 与 JPG→PDF 同引擎，加版式参数（网格/边距/说明文字） | P3 |
| Scan to PDF | 🟡 | WebView2 内 getUserMedia 拍照 → `PdfEnhanceView` 增强（已有）→ JPG→PDF 合成 | P3 |
| PDF→PDF/A | ❌ | 离线无轻量方案（实用方案 Ghostscript 是 AGPL 二进制）→ **明确不做**，UI 不承诺 | — |

---

## 3. 开源方案调研结论（渠道：GitHub / PyPI / r/selfhosted）

调研过的三个「全家桶」级项目结论：**都不可直接嵌入，只作实现参考**。

| 项目 | 形态 | 为什么不嵌入 | 值得抄什么 |
| --- | --- | --- | --- |
| [Stirling-PDF](https://github.com/Stirling-Tools/stirling-pdf)（50+ 工具，事实标准） | Java + Docker | Java 应用，重依赖 LibreOffice/Tesseract/qpdf/OCRmyPDF 二进制 | 工具分类法（Organize/Optimize/Convert/Edit/Security）、参数面板设计 |
| [BentoPDF](https://github.com/goodtab/bentopdf)（纯浏览器端，~9MB） | 纯前端 pdf-lib/pdf.js | 整体是独立 Web 应用 | 证明页面级 12+ 工具可纯前端离线完成——与本项目 F 引擎策略一致 |
| [OmniTools](https://github.com/iib0011/omni-tools)（80+ 文件工具） | Docker Web 应用 | 独立栈 | 工具卡片式首页交互 |

**最终选型（2026-08-30 决策：100% 宽松许可，零商业授权，PyMuPDF 逐步退出）：**

| 库 | 用途 | 许可 | 依赖 |
| --- | --- | --- | --- |
| pypdfium2 | 渲染/栅格化/文本抽取（替代 PyMuPDF 渲染层） | Apache-2.0 | 自带 PDFium 二进制 wheel，无外部依赖 |
| pikepdf | 修复/加密/低层写操作 | MPL-2.0（弱传染，不改其源码即可闭源商用） | qpdf（wheel 自带） |
| pypdf | 页面级操作/表单填写 | BSD-3 | — |
| reportlab | 内容叠加/页码/水印/HTML 子集生成 PDF | BSD-3 | — |
| pdfplumber | PDF→Excel 表格抽取、PDF→Word 文本抽取 | MIT | pdfminer.six（纯 Python） |
| python-pptx | PDF→PPT 贴图成片 | MIT | lxml |
| openpyxl | Excel 写入/读取 | MIT | — |
| mammoth | docx→HTML（Word→PDF 兜底链） | BSD-2 | — |
| RapidOCR（复用） | OCR 用户工具 | Apache-2.0 | 零新增 |
| 前端 pdf-lib + PDF.js | 页面级工具主引擎（MIT / Apache-2.0） | 宽松 | 已在栈内 |

**刻意排除**（第一性原理：离线 EXE + 公开发布两条硬约束 + 零商业授权决策）：
- **PyMuPDF（AGPL-3.0）**：以 EXE 公开发布需整包开源或购买 Artifex 商业授权 → **决策：不购买，逐步迁移退出**，见 Phase M。
- **pdf2docx**：MIT 许可本身没问题，但硬依赖 PyMuPDF → 随 PyMuPDF 一并排除，PDF→Word 改自研。
- WeasyPrint：BSD 许可但需 Pango/GTK DLL，PyInstaller 打包地狱 → 用 reportlab（platypus）+ 自研 HTML/markdown 子集解析替代。
- ocrmypdf：需 Tesseract 外部二进制 → 复用栈内 RapidOCR。
- Ghostscript（PDF/A）：AGPL 二进制 → PDF/A 明确不承诺。
- img2pdf（LGPL-3.0）：图片合成 PDF 改用前端 pdf-lib 实现（JPEG/PNG 直接嵌入）。

---

## 4. 分阶段实施计划

### Phase 0 — 死资产接线（0.5–1 天，零新依赖）
1. JPG→PDF：前端 pdf-lib 直接嵌入 JPEG/PNG，新增 `PdfImagesToPdfView`（不走后端 `image_merge.py`，避免加深 PyMuPDF 依赖）。
2. 水印：`officeCore.ts:addPdfWatermark` 迁入 `pdfCore.ts`，新增 `PdfWatermarkView`（文字/图片、透明度、平铺、位置）。
3. 拆分增强：`PdfSplitView` 加「范围模式」（`1-3,5,8-`），实现从 officeCore 迁入 pdfCore。
4. `requirements.txt` 补 `pywin32`，让 PPT→PDF 的 COM 兜底真正生效。
5. `pdfKit`/`PdfSplitView` 下载路径统一走 `lib/deliver.ts`。

### Phase 1 — 纯前端页面级工具包（约 1 周，仍零新 Python 依赖）
全部基于 pdf-lib + PDF.js，进 PDF center：
- **Page numbers**（位置九宫格/字号/起始页/格式 `1` `- 1` `Page 1`）
- **Extract pages**（勾选页 → 新 PDF）
- **Crop PDF**（首页定框 → 应用全部/所选页）
- **权限位 UI**（挂进 EncryptView：禁打印/禁复制/禁修改）
- **可视化 Organize**（PDF.js 缩略图网格 + 拖拽排序/旋转/删除/插入占位，替代现有行列表；复用 imagecenter 的 canvas 经验）
- **手绘签名**（canvas 写字 → PNG → 盖章到指定页；不带证书，证书级在 P3）

### Phase 2 — 后端转换引擎（1.5–2 周，核心缺口，全程宽松许可）
后端新增 `backend_convert_tools.py`（router `/api/convert`），沿用 PPT 渲染的**能力探测 + 任务轮询**模式：
- `GET /api/convert/capability`：上报 Word COM / Excel COM / 引擎版本。
- `POST /api/convert/pdf-to-word`：自研链路 pdfplumber（文本+表格+坐标）→ python-docx 重建；扫描件引导走 OCR 导出。
- `POST /api/convert/pdf-to-excel`：pdfplumber 表格抽取 → openpyxl。
- `POST /api/convert/pdf-to-ppt`：pypdfium2 逐页渲染 → python-pptx 整页贴图（诚实标注：视觉版式还原，非可编辑文本还原——iLovePDF 此项同为页图片方案时可接受）。
- `POST /api/convert/office-to-pdf`：.docx/.xlsx → COM（保真优先）；无 Office 时 .docx 走 mammoth→HTML→reportlab 兜底、.xlsx 走 openpyxl→HTML→reportlab 兜底，CapabilityGate 明示降级。
- `POST /api/convert/html-to-pdf`：reportlab platypus + HTML/markdown 子集解析（接受本地文件或粘贴内容，避免联网）。
- `POST /api/convert/compress-deep`：pypdfium2 渲染 + 图片重编码（DPI 目标 + JPEG 质量档）+ pikepdf 回写，与前端轻压缩互补。
- `POST /api/convert/repair`：pikepdf open+save（qpdf 恢复模式）。
- `POST /api/convert/ocr-export`：RapidOCR 全文 → TXT / 可检索 sandwich PDF（reportlab 文字层 + pikepdf 合并）。
所有产物落 `output/`，前端新增 `ConvertView*` 系列，走 jobs 轮询 + `ExportDownloadButton` 交付。

### Phase M — PyMuPDF 退出迁移（公开发布前置条件，1–2 周 + 完整回归）

> **✅ 已完成（2026-08-30）**：全仓 `import fitz` 归零；`core/pdfio.py`（pypdfium2+pdfplumber 读取层）与 `core/redact/pikepdf_engine.py`（内容流抹除引擎）上线；PyMuPDF 卸载 + requirements 除名；`release_acceptance.py` 新增 `no_agpl_components` 断言；EXE 重打包后门禁全绿；pytest 112 passed（无 PyMuPDF 环境）。31 样本回归待样本目录到位后补跑。明细见 PROJECT_STATUS.md 对应轮次节。

AGPL 清零迁移，**发布门禁项**，可与其他阶段穿插推进：
1. 盘点 `core/` 与 `server_bridge.py` 中全部 `import fitz` 使用点（渲染、文本抽取、写白块/黑块、预览）。
2. 渲染层 → pypdfium2（`render_page` 等价替换，含 DPI/裁剪参数对齐）。
3. 文本+坐标抽取 → pypdfium2 textpage 或 pdfminer.six。
4. 抹除块写入 → pikepdf 内容流追加或 reportlab 遮盖层 + pypdf merge_page。
5. `backend_ppt_tools.py` 渲染路径同步切换。
6. `requirements.txt` 移除 PyMuPDF；`scripts/release_acceptance.py` 增加断言：产物 wheel 列表无 AGPL 组件。
7. 跑完整三重验收（全文检索零命中 / 目检不越框 / 样本回归），必要时调参补偿引擎差异。

### Phase 3 — 编辑与安全进阶（约 1 周）
- **PDF 编辑器**（文字/图形/高亮批注）：canvas 覆盖层 + pdf-lib 追加内容流；这是前端工作量最大单项，可拆两期（先文字+图形，后高亮/批注）。
- **PDF Forms**：pdf-lib 填写已有 AcroForm 字段（文本/复选/下拉）+ 保存；创建空白可填表单为次优先。
- **证书签名**：pyHanko，.pfx 证书 + 可见签名图章（PAdES-B.T / B.LT 可选）。
- **Scan to PDF**：getUserMedia 拍照 → 现有 `PdfEnhanceView` 增强 → Phase 0 的图片合成 PDF 串联。
- **Compare PDFs**：文本 diff 报告 + 双页渲染叠加差异图。

### Phase 4 — 收尾与门禁（0.5 周）
- PDF center 导航按 iLovePDF 分类法重组：**整理 / 转换 / 编辑 / 安全** 四组（SubNavPills 已支持）。
- 工具首页网格（可选）。
- `output/` 与 `temp_bridge_files/` 清理端点。
- 新工具逐个补 pytest（转换工具用合成样本断言可打开/可抽取/页数一致）。
- `scripts/release_acceptance.py` 增列：无新增违规许可、COM 缺失时能力门控降级正常。

---

## 5. 工作量与优先级总览

| 阶段 | 内容 | 新增功能数 | 新依赖 | 预估 |
| --- | --- | --- | --- | --- |
| P0 | 死资产接线 + 技术债 | +3 完整 +2 增强 | 0 | 0.5–1 天 |
| P1 | 纯前端页面级 | +6 | 0 | ~1 周 |
| P2 | 转换引擎（真瓶颈，宽松许可） | +8 | pypdfium2/pikepdf/pypdf/pdfplumber/python-pptx/openpyxl/mammoth/reportlab | 1.5–2 周 |
| P3 | 编辑/表单/签名 | +5 | pyHanko（MIT） | ~1 周 |
| M | PyMuPDF 退出迁移（发布门禁） | — | −PyMuPDF | 1–2 周 + 回归 |
| P4 | 收尾门禁 | — | — | 0.5 周 |

完成后对照 iLovePDF 26 项：**24 项覆盖，2 项明确不承诺**（PDF/A——无合规离线方案；服务器端高保真 OCR 语种广度——RapidOCR 覆盖中英为主，UI 如实标注）。

---

## 6. 风险与门禁

1. **许可（已决策，2026-08-30）**：**不购买任何商业授权，全栈 100% 宽松许可**。PyMuPDF（AGPL）按 Phase M 逐步退出：渲染 → pypdfium2（Apache-2.0），写操作 → pikepdf（MPL-2.0，弱传染，不改源码即可闭源分发）+ pypdf（BSD）+ reportlab（BSD）。新增库全部许可安全。Phase M 完成前不对外发布 EXE。
2. **保真度预期管理**：PDF→Word/Excel 对复杂版式/扫描件不可能 100% 还原（iLovePDF 同样做不到），转换完成页应标注引擎与已知局限；扫描件 PDF→Word 应引导走 OCR 导出而非 pdf2docx。
3. **Word/Excel→PDF 的 COM 依赖**：目标用户若无 Office，走 HTML 兜底（保真下降）。CapabilityGate 必须如实展示当前引擎，禁止静默降级。
4. **打包体积**：新依赖全为纯 Python wheel（pikepdf 带 qpdf 静态 wheel），预计 EXE 增量 < 15 MB，可接受。
5. **离线承诺**：全部工具零联网；HTML→PDF 仅接受本地文件/粘贴内容；签名生成流程本地，不做时间戳服务器（TSA）联网签，UI 标注。

---

## 7. 明确不做什么

- 不引入 Docker/Java/Node 后端（Stirling-PDF/Gotenberg 路线）——与单 EXE 离线形态冲突。
- **不购买 Artifex 商业授权，不整包 AGPL 开源**——PyMuPDF 按 Phase M 退出。
- 不做 PDF/A 转换。
- 不做云端协作式 eSign（发起签署链接、多方签署）——pyHanko 只做本地证书签。
- 不承诺扫描件的高保真 PDF→Word/Excel。
- 不把 iLovePDF 的品牌/UI 抄过来，只对齐功能集。
