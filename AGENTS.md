# ZonScale Agent 宪法

## 项目定位

**ZonScale**（by zonlic）：本地离线脱敏工作台，面向公开发布与通用客户场景。

- 读入 PDF 工程图纸、行政 PDF、Word 文档，在框线约束内抹除用户**自行配置**的敏感词、Logo、保密标记。
- 输出 `原名_desensitized` / `_redacted` 后缀副本，不修改原始文件。
- 技术栈：React + FastAPI + pywebview 桌面壳；核心引擎在 `core/`。

**与兄弟项目的关系**

| 工作区 | 路径 | 用途 |
| --- | --- | --- |
| **ZonScale（本仓库）** | `Desktop/ZonScale` | 公开发布版，**禁止**内置 Fisher/Emerson/TopWorx/MKS 等企业规则与 Logo |
| **公司内建版** | `Desktop/experiment/Desensitization` | 内部 PyQt 工具，内置厂商词表与 Logo，样本回归 |

两仓库共享同源 `core/` 脱敏引擎，但 UI、打包、规则真源、验收门禁**完全分离**，不得混用。

## 核心原则

- 发布版 `rules/` 仅含通用保密词示例；企业名、Logo 由用户在规则中心或 `rules/` 目录自行维护。
- 禁止在代码中硬编码特定公司名称；词表变更走文件，不改代码。
- 打包前必须通过 `build_zonscale_exe.bat` 内的 clean rules 检查与 `scripts/release_acceptance.py`。
- 升级 EXE 时 `rules/` 采用「仅补缺不覆盖」策略——文档与 UI 须提示用户清理旧版厂商规则残留。

## 入口与命令

| 场景 | 命令 |
| --- | --- |
| 开发（浏览器） | `python launch_app.py` 或 `python run_modern_app.py` |
| 开发（pywebview 壳） | `python desktop_app.py` |
| 前端构建 | `cd frontend && npm run build` → `dist_web/` |
| Windows EXE | `build_zonscale_exe.bat` |
| macOS .app | `./build_zonscale_mac.sh` |
| 回归 | `pytest` + `python scripts/release_acceptance.py` |

## 验收规则

脱敏验收三重证据（工程图纸）：

1. 输出 PDF 全文检索敏感词 → 零命中；
2. 渲染目检抹除块未越框；
3. 用户样本或合成样本回归。

发布版额外门禁：`release_acceptance.py` 确认 `rules/` 无厂商词、无预置 Logo 文件。

## Git 规则

- 不得提交客户原始图纸、`dist/`、`dist_release/`、`frontend/node_modules/`。
- 不得提交任何未授权企业 Logo 或专有词表到公开仓库。
