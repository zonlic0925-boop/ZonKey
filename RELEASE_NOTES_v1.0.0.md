## ZonKey v1.0.0

**工程图纸与文档 · 本地离线智能脱敏工作台** · by zonlic

首个正式交付版本。

### 亮点

- **现代化工作台**：React + FastAPI + PyWebView 桌面壳，孟菲斯风格 UI
- **多格式脱敏**：工程图纸 PDF · 通用行政 PDF · Word 文档
- **三通道检测**：矢量文字 + RapidOCR 栅格 + Logo 视觉模板
- **框线归位**：抹除严格限制在单元格/方框内，越框标待人工确认
- **规则中心**：公司名、Logo、保密词等脱敏规则自行选择维护，支持热重载
- **100% 离线**：无云端请求，不修改原始文件，输出 `*_desensitized` 副本
- **三语界面**：简体中文 / 繁體中文 / English
- **局域网预览**：手机同 WiFi 可浏览（可选）

### Windows 安装

1. 下载 **ZonKey_Windows_x64_1.0.0.zip**
2. 解压到任意目录
3. 双击 `ZonKey.exe` 或 `启动现代化脱敏工作台.bat`
4. 内嵌窗口 / 浏览器访问 `http://127.0.0.1:8765`

### 系统要求

- Windows 10 / 11（64 位）
- 无需单独安装 Python

### 源码构建

```powershell
git clone https://github.com/zonlic0925-boop/ZonKey.git
cd ZonKey
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python run_modern_app.py
```

### 对应提交

`f7488d9`
