import fs from 'fs';
const file = 'C:/Users/Zonlic/Desktop/ZonKey/docs/AGENTS_HANDOFF.md';
let t = fs.readFileSync(file, 'utf-8');
t = t.replace(
  "→ P3（编辑/表单/签名）→ P4 收尾",
  "→ **P3（编辑/表单/手绘签名第一期已完成）** → P4 收尾"
);
fs.writeFileSync(file, t);

const statusFile = 'C:/Users/Zonlic/Desktop/ZonKey/docs/PROJECT_STATUS.md';
let s = fs.readFileSync(statusFile, 'utf-8');
s = s.replace(
  "## 2026-08-30 进度",
  "## 2026-08-30 第2版进度 (P3 编辑器与纯前端特性集成)\n- 表单填写(PDF Forms)\n- 证书签名(pyHanko 后端打通)\n- 手写签名板前端落盘\n- 增强安全权限选项(`pikepdf`全量加密)\n- 纯前端本地PDF画板/编辑器。\n\n## 2026-08-30 进度"
);
fs.writeFileSync(statusFile, s);
