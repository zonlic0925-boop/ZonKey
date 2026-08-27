import sys
from pathlib import Path

# 确保项目根目录在 sys.path 中
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 构建发布版本
from scripts.build_clean_release import build_release
rel_path = build_release()
print("Release build completed at:", rel_path)
