# ZonScale & ToolKnit 全量功能整合与 UI 重构计划

> **版本**：v2.1.0-integration  
> **制定日期**：2026-08-28  
> **目标**：以高标准设计工程规范（Web Interface Guidelines & Emil Kowalski 交互美学）重构 ZonScale 界面交互，并将 \	oolknit-desktop-2.1.1\ 的全部 60 项工具全量迁移并收敛至 ZonScale 统一工作台的 **8 大核心中心**。

---

## 一、当前页面审查与 UI 重构设计方案

### 1. 结构与架构冲突消除（双 Header 治理）
- **现状缺陷**：\src/components/Header.tsx\ 与 \src/components/navigation/Header.tsx\ 双头并存，导致 App 顶层容器高度重复计算、布局断层、路由状态分化。
- **重构方案**：
  - 彻底删除废弃的根组件 \src/components/Header.tsx\；
  - 统一定位并升级 \src/components/navigation/Header.tsx\ 作为全局唯一主导航；
  - 在 \App.tsx\ 中建立清晰的路由中心状态映射。

### 2. 布局稳定性与弹簧动效（消除 Layout Shift）
- **现状缺陷**：一级中心切换至含二级子工具的中心时，导航容器高度跳变引发全页抖动；Tab 切换无连续物理反馈。
- **重构方案**：
  - 采用固定高度容器结构（Fixed-height Layout / CSS Flex Grid），使主导航与子导航高度恒定，消灭累积布局偏移（CLS = 0）；
  - 子导航 Pill 采用 Framer Motion 的 \layoutId="activeSubTabPill"\ 与弹簧物理曲线（Spring: \{ type: "spring", stiffness: 450, damping: 35 }\），提供平滑灵动的跟手交互。

### 3. Memphis 视觉阶梯与对比度规范（WCAG AA）
- **现状缺陷**：部分卡片深色文字与浅色背景对比度不足，实体边框过多造成视觉噪声（Visual Noise）。
- **重构方案**：
  - 确立清晰语义色阶：主标题 \	ext-zinc-900\、正文 \	ext-zinc-700\、辅助描述 \	ext-zinc-400\；
  - 保持外层顶层卡片的 Memphis 鲜明个性，内层复杂交互面板采用克制的 \order-zinc-200\ 细边框与柔和微阴影（Subtle Shadow）。

---

## 二、ToolKnit 60 项全量功能迁移与代码对应关系

经全量逆向分析，\	oolknit-desktop-2.1.1\ 共包含 12 个模块、60 个具体功能工具。本项目将按以下对应关系完整迁移并收敛至 ZonScale 8 大核心中心：

| 序号 | ZonScale 归属中心 | 子功能 ID | 功能中文名 | ToolKnit 源文件路径 | 核心技术方案 |
|---|---|---|---|---|---|
| 1 | **1. 智能脱敏 (redact)** | drawing | 工程图纸脱敏 | ZonScale core/ (原生) | 矢量格线归位 + OCR + 双通道擦除 |
| 2 | 智能脱敏 (redact) | pdf_doc | 公文 PDF 脱敏 | ZonScale core/ (原生) | 段落文本重排与精准抹除 |
| 3 | 智能脱敏 (redact) | word_doc | Word 文档脱敏 | ZonScale core/ (原生) | docx XML 解析与占位符替换 |
| 4 | 智能脱敏 (redact) | rules | 规则策略中心 | ZonScale core/ (原生) | 外部词表 + 自定义正则 + 实时热加载 |
| 5 | 智能脱敏 (redact) | audit | 审计日志流水 | ZonScale core/ (原生) | 本地不可篡改审计追踪 |
| 6 | **2. PDF 工坊 (pdf_center)** | pdf-editor | PDF 页面编辑器 | \src/pdf-editor-core.js\ | 纯前端 pdf-lib 页面增删/重排/旋转 |
| 7 | PDF 工坊 (pdf_center) | pdf-merge | PDF 多文件合并 | \src/pdf-merge-core.js\ | 纯前端 pdf-lib 多流合并与索引注入 |
| 8 | PDF 工坊 (pdf_center) | pdf-split | PDF 范围拆分 | \src/pdf-split-core.js\ | 纯前端 pdf-lib 范围提取多文件 |
| 9 | PDF 工坊 (pdf_center) | pdf-to-image | PDF 逐页转图片 | \src/pdf-to-image-core.js\ | PDF.js + Canvas 离屏高清栅格化 |
| 10 | PDF 工坊 (pdf_center) | pdf-rotate | PDF 方向旋转 | \src/pdf-rotate-core.js\ | 纯前端 pdf-lib 页面矩阵旋转 |
| 11 | PDF 工坊 (pdf_center) | pdf-encrypt | PDF 安全加密 | \src/pdf-encrypt-core.js\ | pdf-lib 权限与口令设置 |
| 12 | PDF 工坊 (pdf_center) | pdf-decrypt | PDF 口令解密 | \src/pdf-decrypt-core.js\ | pdf-lib 口令验证与无密码重写 |
| 13 | PDF 工坊 (pdf_center) | pdf-compress | PDF 体积压缩 | \src/pdf-compress-core.js\ | 流精简与图片质量重压缩 |
| 14 | PDF 工坊 (pdf_center) | pdf-enhance | PDF 扫描件增强 | \src/pdf-enhance-core.js\ | Canvas 图像对比度与二值化增强 |
| 15 | **3. PPT 工坊 (ppt_center)** | ppt-to-pdf | PPT 转 PDF | \src/ppt-render-core.js\ | JSZip + PPTX XML 解析 + PDFKit 渲染 |
| 16 | PPT 工坊 (ppt_center) | ppt-to-image | PPT 转高清长图 | \src/ppt-render-core.js\ | PPTX 幻灯片逐页 Canvas 渲染 |
| 17 | PPT 工坊 (ppt_center) | ppt-images | PPT 内嵌图片提取 | \src/ppt-image-extract-core.js\ | JSZip 解压 \ppt/media/\ 并打包下载 |
| 18 | PPT 工坊 (ppt_center) | ppt-text | PPT 文本大纲提取 | \src/ppt-text-extract-core.js\ | 解析幻灯片文本框与演讲者备注 |
| 19 | PPT 工坊 (ppt_center) | ppt-compress | PPTX 瘦身压缩 | \src/ppt-compress-core.js\ | 批量重压缩内嵌多媒体资源 |
| 20 | PPT 工坊 (ppt_center) | ppt-outline | AI 幻灯片大纲生成 | \src/ppt-outline-core.js\ | 离线模板驱动或配置 API 生成结构化大纲 |
| 21 | PPT 工坊 (ppt_center) | ppt-draft | AI 幻灯片草稿生成 | \src/ppt-draft-core.js\ | 自动构建合法 PPTX 文件下载 |
| 22 | **4. 图像工坊 (image_center)** | image-crop | 图像自由裁剪 | \src/image-crop-core.js\ | Canvas 自由选区与固定比例裁剪 |
| 23 | 图像工坊 (image_center) | image-color-replace | 多通道色彩替换 | \src/image-color-replace-core.js\ | Canvas/WebWorker 像素级容差色彩置换 |
| 24 | 图像工坊 (image_center) | image-convert | 图像格式互转 | \src/image-batch-core.js\ | Canvas 跨格式转码导出 |
| 25 | 图像工坊 (image_center) | image-compress | 图像质量压缩 | \src/image-batch-core.js\ | 动态质量系数与分辨率降采样 |
| 26 | 图像工坊 (image_center) | image-stitch | 多图拼接 (横/纵/网格) | \src/image-stitch-core.js\ | Canvas 多图自适应排版拼接 |
| 27 | 图像工坊 (image_center) | icon-gen | 多尺寸应用图标生成 | \src/icon-gen-core.js\ | 一键生成 iOS/Android/Favicon 尺寸集 |
| 28 | 图像工坊 (image_center) | color-extractor | 主题取色与色板提取 | \src/color-extractor-core.js\ | K-means 颜色聚类与调色盘提取 |
| 29 | 图像工坊 (image_center) | color-space-compare | 色彩空间色域对比 | \src/color-space-compare-core.js\ | sRGB/Display-P3/AdobeRGB 三维色彩转换 |
| 30 | **5. 音视频中心 (media_center)** | bpm-detect | BPM 音乐节拍测速 | \src/bpm-detect-core.js\ | Web Audio API 离线峰值能量滤波分析 |
| 31 | 音视频中心 (media_center) | audio-clip | 音频可视化波形裁剪 | \src/audio-clip-core.js\ | Web Audio 离线渲染与 PCM 块截取 |
| 32 | 音视频中心 (media_center) | audio-convert | 音频格式互转 | \src/audio-convert-core.js\ | Web Audio 解码转 WAV/MP3 |
| 33 | 音视频中心 (media_center) | audio-extract | 视频提取纯音频 | \src/audio-extract-core.js\ | 浏览器端音频流抽取与封装 |
| 34 | 音视频中心 (media_center) | video-convert | 视频格式轻量转换 | \src/video-convert-core.js\ | WebCodecs / MediaRecorder 浏览器转码 |
| 35 | 音视频中心 (media_center) | video-frame | 视频高清单帧截图 | \src/video-frame-core.js\ | HTML5 Video 精确 Seek 与 Canvas 绘制 |
| 36 | 音视频中心 (media_center) | video-gif | 视频片段截取动图 | \src/video-gif-core.js\ | 帧序列提取 + gifshot/omggif 动态合成 |
| 37 | **6. 文本工坊 (text_center)** | markdown-editor | Markdown 实时编辑预览 | \src/markdown-editor-core.js\ | 词法解析 + 实时渲染 + 大纲导航 |
| 38 | 文本工坊 (text_center) | transcription | 离线音视频字幕转写 | \src-tauri/src/voice.rs\ | 本地轻量语音识别/转写接口 |
| 39 | 文本工坊 (text_center) | text-stats | 文本深度统计与分析 | \src/text-stats-core.js\ | 中英字符/词汇/阅读时长/段落分析 |
| 40 | 文本工坊 (text_center) | text-format | 排版格式化与盘古之白 | \src/text-format-core.js\ | 中英文空隙自动补全、标点规范化 |
| 41 | 文本工坊 (text_center) | typing-test | 极客打字测速与词库 | \src/data/typing-words.json\ | 实时 WPM/准确率/击键节奏引擎 |
| 42 | **7. 计算开发 (calc_dev)** | bmi-calc | 体脂与健康代谢计算 | \src/main.js\ | 科学公式 (BMI/BMR/体脂率) |
| 43 | 计算开发 (calc_dev) | timestamp-calc | Unix 时间戳转换 | \src/main.js\ | 毫秒/秒级多时区双向实时换算 |
| 44 | 计算开发 (calc_dev) | mortgage-calc | 房贷等额本息/本金 | \src/main.js\ | 贷款利息试算与逐期还款明细生成 |
| 45 | 计算开发 (calc_dev) | interest-calc | 复利与投资理财计算 | \src/main.js\ | 年化收益与定投复利复核 |
| 46 | 计算开发 (calc_dev) | password-gen | 高强度防碰撞密码生成 | \src/password-core.js\ | 密码熵计算与自定义字符集生成 |
| 47 | 计算开发 (calc_dev) | json-tools | JSON 格式化与 Diff | \src/developer-toolbox-core.js\ | 语法树校验、格式化、对比与压缩 |
| 48 | 计算开发 (calc_dev) | base64 | Base64 双向编解码 | \src/developer-toolbox-core.js\ | 支持 UTF-8 文本与文件 Base64 编码 |
| 49 | 计算开发 (calc_dev) | url-codec | URL 编解码与参数解析 | \src/developer-toolbox-core.js\ | 查询参数分离与 Encode/Decode URI |
| 50 | 计算开发 (calc_dev) | uuid | UUID/GUID 批量生成器 | \src/developer-toolbox-core.js\ | Web Crypto 强随机数生成 RFC4122 v4 |
| 51 | 计算开发 (calc_dev) | jwt | JWT 令牌结构分析器 | \src/developer-toolbox-core.js\ | Header/Payload 提取与过期时间检测 |
| 52 | 计算开发 (calc_dev) | hash-crypto | 17 种哈希与加密算法套件 | \src/crypto-tool-core.js\ | MD5/SHA-256/AES/DES/SM4/RSA 套件 |
| 53 | **8. 系统硬件 (system_tools)** | large-file-cleanup | 大文件智能扫描清理 | \src-tauri/src/system_cleanup.rs\ | 本地磁盘文件大小聚类与安全扫描 |
| 54 | 系统硬件 (system_tools) | c-drive-cleanup | 系统盘与临时缓存清理 | \src-tauri/src/system_cleanup.rs\ | 临时目录/系统垃圾特征扫描清理 |
| 55 | 系统硬件 (system_tools) | hardware-overview | 系统综合概览 | \src-tauri/src/lib.rs\ | 操作系统、架构与运行环境 |
| 56 | 系统硬件 (system_tools) | hardware-cpu-memory | CPU 拓扑与内存诊断 | \src-tauri/src/lib.rs\ | 物理核心、逻辑线程与可用内存 |
| 57 | 系统硬件 (system_tools) | hardware-gpu-display | 显卡与显示设备信息 | \src-tauri/src/lib.rs\ | GPU 型号、显存与显示器分辨率 |
| 58 | 系统硬件 (system_tools) | hardware-mainboard | 主板与 BIOS 诊断 | \src-tauri/src/lib.rs\ | 主板型号、厂商与系统版本 |
| 59 | 系统硬件 (system_tools) | hardware-storage | 磁盘存储健康监控 | \src-tauri/src/lib.rs\ | 分区使用率与存储卷明细 |
| 60 | 系统硬件 (system_tools) | hardware-power-sensors | 网络设备与传感器状态 | \src-tauri/src/lib.rs\ | 网卡适配器与外设状态 |

---

## 三、分步实施计划（4 个执行阶段）

### 阶段一：基础类型、多语言与全局导航重构 (Foundation & Navigation)
1. **类型定义扩展**：更新 \rontend/src/types/index.ts\，新增 8 大中心（edact\, \pdf_center\, \ppt_center\, \image_center\, \media_center\, \	ext_center\, \calc_dev\, \system_tools\）及对应的所有二级 Tab 字面量类型。
2. **多语言词条补全**：扩充 \zh-CN.ts\, \n.ts\, \zh-TW.ts\，补充全部 60 项工具的名称、描述与操作提示。
3. **导航组件单一化**：
   - 彻底删除 \rontend/src/components/Header.tsx\；
   - 升级 \rontend/src/components/navigation/Header.tsx\，增加 8 大中心切换与平滑弹簧微动效；
   - 升级 \rontend/src/components/navigation/SubNavPills.tsx\，确保二级导航无布局抖动。

### 阶段二：前端核心计算与开发模块整合 (Client-Side Engines)
1. **计算与开发中心 (\CalcDevStudioView.tsx\)**：集成 Base64、URL、UUID、JWT、JSON Diff/格式化、哈希与加解密套件、房贷/复利/BMI/时间戳/密码生成器。
2. **文本工坊中心 (\TextStudioView.tsx\)**：集成 Markdown 实时编辑器、排版美化（盘古之白/全半角）、文本深度统计、打字测速引擎。
3. **图像与色彩工坊 (\ImageStudioView.tsx\)**：集成图片裁剪、多通道颜色替换、格式转换、质量压缩、多图拼接、图标生成器、取色板与色彩空间对比。
4. **音视频中心 (\MediaStudioView.tsx\)**：集成 BPM 检测、音频波形裁剪、音频转码、音轨提取、视频抽帧与视频转 GIF。

### 阶段三：办公文档中心迁移 (PDF & PPT Studios)
1. **PDF 工坊 (\PdfStudioView.tsx\)**：完善 9 大功能（页面编辑、合并、拆分、转图片、旋转、加密、解密、压缩、增强）。
2. **PPT 工坊 (\PptStudioView.tsx\)**：实现 7 大功能（PPT 转 PDF、转图片、内嵌图片提取、大纲提取、PPT 压缩瘦身、AI 大纲与草稿生成）。

### 阶段四：系统硬件面板与全链路验证 (System Tools & Validation)
1. **系统工具面板 (\SystemToolsView.tsx\)**：实现硬件概览、CPU/内存/显卡/磁盘存储/网络状态，以及大文件/系统垃圾分析面板。
2. **顶层路由接入**：在 \App.tsx\ 中无缝切换 8 大中心视图。
3. **构建与类型验证**：执行 pm run build\ 确保 TypeScript 编译通过，无任何类型缺失与打包警告。

---

## 四、验证与交付标准

1. **零编译报错**：`frontend` 目录 `npm run build` 编译打包 100% 成功；
2. **零布局偏移**：导航栏切换时无容器高度突变（CLS = 0）；
3. **功能完整度**：60 项工具全部在 8 大中心对应挂载，交互顺畅，数据本地化优先。

---

## 五、执行状态登记（2026-08-29 收尾）

### 5.1 分阶段提交记录（全部完成）

| 阶段 | 提交 | 内容 |
|---|---|---|
| Phase 1 | `cad0810` | 两级 8 中心导航骨架（废弃根 `Header.tsx`，统一 `components/Header.tsx` + `navigation/SubNavPills.tsx`） |
| Phase 2 | `429e152` | 计算开发中心 11 工具（BMI/时间戳/房贷/复利/密码/JSON/Base64/URL/UUID/JWT/哈希加解密） |
| Phase 3 | `8caf9fd` | 文本工坊 3 工具（Markdown 编辑器/文本统计/排版格式化） |
| Phase 4 | `9790e94` | PDF 工坊批次 1（合并/拆分/旋转/压缩） |
| Phase 5 | `b3f4d28` | 图像工坊 7 工具（裁剪/色彩替换/格式转换/压缩/拼接/图标生成/取色板） |
| Phase 6 | `cf817e6` | PPT 工坊 3 工具（内嵌图片提取/大纲提取/瘦身压缩） |
| Phase 7 | `8964021` | 音视频中心 5 工具（BPM 检测/波形裁剪/格式互转/音轨提取/视频抽帧） |
| Phase 8 | `3da657f` | 系统硬件中心 8 工具经 FastAPI（`backend_system_tools.py`：硬件概览/CPU 内存/显卡/主板/磁盘/网络传感器/大文件清理/C 盘清理） |
| 收尾 | 本提交 | 孤儿文件清理 + 文档状态登记 + 全量验证（pytest / `npm run build` / `release_acceptance.py`） |

### 5.2 工具接线统计（来源 `frontend/src/lib/navigation.tsx`）

- **60 项工具全部挂载**到 8 大中心；其中 **46 项 ready**、**14 项 planned**（UI 显示"即将上线"占位，不虚报可用）。
- planned 明细：PDF 工坊 5（页面编辑器/转图片/加密/解密/扫描增强）、PPT 工坊 4（转 PDF/转图片/AI 大纲/AI 草稿）、音视频 2（视频转码/视频转 GIF）、文本 2（离线转写/打字测速）、色彩 1（色彩空间色域对比）。

### 5.3 后续批次（2026-08-29 用户指定优先级，未在本期实施）

按用户口述顺序登记：

1. **PDF 批次**：PDF 转图片、加密、解密、扫描增强、页面编辑器；
2. **音视频批次**：视频转码、视频转 GIF；
3. **调性检测**：若指音乐调性（key）分析，为 BPM 检测之外的扩展项（BPM 检测已 ready），实施前与用户确认口径；
4. **色彩批次**：色彩空间色域对比。

> 其余 planned（PPT 转 PDF/转图片/AI 大纲/AI 草稿、离线转写、打字测速）排在上述批次之后。

### 5.4 收尾清理明细（本提交）

| 处置 | 对象 | 原因 |
|---|---|---|
| 删除 | `frontend/src/components/navigation/Header.tsx` | 双 Header 治理：统一为 `components/Header.tsx`，旧导航头已无引用 |
| 删除 | `frontend/src/components/pdf/PdfStudioView.tsx` | 被 `pdfcenter/` 实现取代，全仓零引用 |
| 删除 | 空目录 `components/{image,media,devtools,studios,pdf}/` | 迁移残留空壳 |
| 删除 | `packaging/windows/assets/zonscale-test.ico`、`packaging/windows/tools/rcedit-x64.exe` | 图标方案定为 PyInstaller 嵌入（见 `build_zonscale_exe.bat` 注释），rcedit 路线废弃；第三方 exe 不入库 |
| 删除 | 根目录 `_tmp_*.pdf` ×24、`startup_error.log` | 调试残留（均已 gitignore） |
| 保留 | `extracted_tools.json` | ToolKnit 逆向唯一底稿，已 gitignore，零代码引用 |

### 5.5 收尾验证证据（2026-08-29 实测）

- `python -m pytest -q`：见 PROJECT_STATUS.md 当日登记；
- `cd frontend && npm run build`：见 PROJECT_STATUS.md 当日登记；
- `python scripts/release_acceptance.py`：见 PROJECT_STATUS.md 当日登记。
