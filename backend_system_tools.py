import os
import shutil
import ctypes
import platform
import subprocess
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/system", tags=["System Tools"])

def is_admin() -> bool:
    if platform.system() != "Windows":
        return False
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def get_system_drive() -> str:
    return os.environ.get("SystemDrive", "C:")

def get_recycle_bin_size() -> int:
    try:
        cmd = 'powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).Namespace(0x0a).Items() | Measure-Object -Property Size -Sum | Select-Object -ExpandProperty Sum"'
        res = subprocess.check_output(cmd, shell=True, text=True).strip()
        return int(res) if res and res.isdigit() else 0
    except Exception:
        return 0

def empty_recycle_bin() -> int:
    before = get_recycle_bin_size()
    try:
        subprocess.run('powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', shell=True)
    except Exception:
        pass
    return before

def get_folder_size_and_count(folder_path: str, max_depth: int = 4) -> tuple[int, int]:
    if not os.path.exists(folder_path):
        return 0, 0
    total_size = 0
    total_count = 0
    try:
        for root, dirs, files in os.walk(folder_path):
            depth = root[len(folder_path):].count(os.sep)
            if depth > max_depth:
                continue
            for f in files:
                fp = os.path.join(root, f)
                try:
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)
                        total_count += 1
                except Exception:
                    pass
    except Exception:
        pass
    return total_size, total_count

def clean_folder_contents(folder_path: str) -> tuple[int, int]:
    if not os.path.exists(folder_path):
        return 0, 0
    freed_bytes = 0
    deleted_count = 0
    try:
        for item in os.listdir(folder_path):
            item_path = os.path.join(folder_path, item)
            try:
                if os.path.islink(item_path):
                    continue
                if os.path.isfile(item_path):
                    sz = os.path.getsize(item_path)
                    os.remove(item_path)
                    freed_bytes += sz
                    deleted_count += 1
                elif os.path.isdir(item_path):
                    sz, cnt = get_folder_size_and_count(item_path)
                    shutil.rmtree(item_path, ignore_errors=True)
                    freed_bytes += sz
                    deleted_count += cnt
            except Exception:
                pass
    except Exception:
        pass
    return freed_bytes, deleted_count

def get_low_tier_rules() -> List[Dict[str, Any]]:
    rules = []
    temp_dir = os.environ.get("TEMP")
    if temp_dir and os.path.exists(temp_dir):
        rules.append({"id": "user_temp", "name": "用户临时文件 (TEMP)", "path": temp_dir})
    
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        chrome_cache = os.path.join(local_app_data, "Google", "Chrome", "User Data", "Default", "Cache")
        if os.path.exists(chrome_cache):
            rules.append({"id": "chrome_cache", "name": "Chrome 浏览器缓存", "path": chrome_cache})
        edge_cache = os.path.join(local_app_data, "Microsoft", "Edge", "User Data", "Default", "Cache")
        if os.path.exists(edge_cache):
            rules.append({"id": "edge_cache", "name": "Edge 浏览器缓存", "path": edge_cache})
            
    return rules

def get_medium_tier_rules() -> List[Dict[str, Any]]:
    rules = []
    win_dir = os.environ.get("WINDIR", "C:\\Windows")
    sys_temp = os.path.join(win_dir, "Temp")
    if os.path.exists(sys_temp):
        rules.append({"id": "win_temp", "name": "Windows 系统临时文件", "path": sys_temp})
    prefetch = os.path.join(win_dir, "Prefetch")
    if os.path.exists(prefetch):
        rules.append({"id": "win_prefetch", "name": "Windows 预读取文件 (Prefetch)", "path": prefetch})
    soft_dist = os.path.join(win_dir, "SoftwareDistribution", "Download")
    if os.path.exists(soft_dist):
        rules.append({"id": "win_update_cache", "name": "Windows 更新下载缓存", "path": soft_dist})
    return rules

@router.get("/cleanup/scan")
def scan_cleanup():
    admin = is_admin()
    sys_drive = get_system_drive()
    
    # Low tier
    low_rules = get_low_tier_rules()
    low_bytes, low_count = 0, 0
    low_summaries = []
    for r in low_rules:
        sz, cnt = get_folder_size_and_count(r["path"])
        low_bytes += sz
        low_count += cnt
        low_summaries.append({"rule_id": r["id"], "name": r["name"], "bytes": sz, "count": cnt})

    # Medium tier
    med_rules = get_medium_tier_rules()
    med_bytes, med_count = 0, 0
    med_summaries = []
    for r in med_rules:
        sz, cnt = get_folder_size_and_count(r["path"])
        med_bytes += sz
        med_count += cnt
        med_summaries.append({"rule_id": r["id"], "name": r["name"], "bytes": sz, "count": cnt})

    # High tier (Recycle bin)
    recycle_sz = get_recycle_bin_size()
    high_tier = {
        "tier": "high",
        "name": "深度空间释放（回收站等）",
        "bytes": recycle_sz,
        "count": 1 if recycle_sz > 0 else 0,
        "summaries": [{"rule_id": "recycle_bin", "name": "系统回收站", "bytes": recycle_sz, "count": 1}]
    }

    return {
        "system_drive": sys_drive,
        "is_admin": admin,
        "tiers": [
            {"tier": "low", "name": "基础清理 (用户临时文件与浏览器缓存)", "bytes": low_bytes, "count": low_count, "summaries": low_summaries},
            {"tier": "medium", "name": "系统缓存清理 (系统临时文件与更新包)", "bytes": med_bytes, "count": med_count, "summaries": med_summaries},
            high_tier
        ]
    }

class CleanRequest(BaseModel):
    tier: str

@router.post("/cleanup/run")
def run_cleanup(req: CleanRequest):
    tier = req.tier.lower()
    freed_total = 0
    items = []
    
    if tier == "low":
        for r in get_low_tier_rules():
            freed, cnt = clean_folder_contents(r["path"])
            freed_total += freed
            items.append({"rule_id": r["id"], "name": r["name"], "freed_bytes": freed, "ok": True})
    elif tier == "medium":
        for r in get_medium_tier_rules():
            freed, cnt = clean_folder_contents(r["path"])
            freed_total += freed
            items.append({"rule_id": r["id"], "name": r["name"], "freed_bytes": freed, "ok": True})
    elif tier == "high":
        freed = empty_recycle_bin()
        freed_total += freed
        items.append({"rule_id": "recycle_bin", "name": "系统回收站", "freed_bytes": freed, "ok": True})
    else:
        raise HTTPException(status_code=400, detail="Invalid tier")

    return {
        "tier": tier,
        "freed_bytes": freed_total,
        "items": items
    }
