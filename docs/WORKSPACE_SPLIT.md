# 工作区拆分说明

## ZonKey（本仓库 · 公开发布版）

- **路径**：`C:\Users\Zonlic\Desktop\ZonKey`
- **UI**：React + FastAPI + pywebview
- **规则**：无内置厂商词表；用户自定 `rules/`

## 公司内建版

- **路径**：`C:\Users\Zonlic\Desktop\experiment\Desensitization`
- **UI**：PyQt5（`main_ui.py`）
- **规则**：内置 Fisher / Emerson / TopWorx / MKS

两仓库 `core/` 引擎同源但独立副本；发布 ZonKey 时不得混入公司 `rules/logos/`。
