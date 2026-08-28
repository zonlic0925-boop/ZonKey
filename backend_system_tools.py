import os
import shutil
import ctypes
import platform
import subprocess
import socket
import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import psutil

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


# ===== 硬件信息端点（Windows 优先，字段缺失时优雅降级） =====

def _run_powershell(command: str, timeout: int = 8) -> str:
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command],
            capture_output=True, text=True, timeout=timeout
        )
        return result.stdout.strip()
    except Exception:
        return ""


@router.get("/hardware/overview")
def hardware_overview():
    boot_time = time.localtime(psutil.boot_time())
    return {
        "os": f"{platform.system()} {platform.release()}",
        "os_version": platform.version(),
        "arch": platform.machine(),
        "hostname": socket.gethostname(),
        "python": platform.python_version(),
        "boot_time": time.strftime("%Y-%m-%d %H:%M:%S", boot_time),
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "is_admin": is_admin(),
    }


@router.get("/hardware/cpu-memory")
def hardware_cpu_memory():
    freq = psutil.cpu_freq()
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    return {
        "physical_cores": psutil.cpu_count(logical=False),
        "logical_cores": psutil.cpu_count(logical=True),
        "cpu_percent": psutil.cpu_percent(interval=0.25),
        "freq_mhz": round(freq.current, 0) if freq else None,
        "memory_total_bytes": mem.total,
        "memory_used_bytes": mem.used,
        "memory_available_bytes": mem.available,
        "memory_percent": mem.percent,
        "swap_total_bytes": swap.total,
        "swap_percent": swap.percent,
    }


@router.get("/hardware/gpu-display")
def hardware_gpu_display():
    raw = _run_powershell(
        "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,AdapterRAM | ConvertTo-Json -Compress"
    )
    gpus: List[Dict[str, Any]] = []
    if raw:
        import json
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                data = [data]
            for item in data:
                gpus.append({
                    "name": item.get("Name"),
                    "driver_version": item.get("DriverVersion"),
                    "adapter_ram_bytes": item.get("AdapterRAM"),
                })
        except Exception:
            pass
    resolution = None
    if platform.system() == "Windows":
        try:
            user32 = ctypes.windll.user32
            resolution = {"width": user32.GetSystemMetrics(0), "height": user32.GetSystemMetrics(1)}
        except Exception:
            pass
    return {"gpus": gpus, "resolution": resolution}


@router.get("/hardware/mainboard")
def hardware_mainboard():
    import json

    def query_to_dict(command: str) -> Dict[str, Any]:
        raw = _run_powershell(command)
        if not raw:
            return {}
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                data = data[0] if data else {}
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    board_raw = query_to_dict(
        "Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product,Version | ConvertTo-Json -Compress"
    )
    bios_raw = query_to_dict(
        "Get-CimInstance Win32_BIOS | Select-Object Manufacturer,SMBIOSBIOSVersion,ReleaseDate | ConvertTo-Json -Compress"
    )
    return {
        "board": {
            "manufacturer": board_raw.get("Manufacturer"),
            "product": board_raw.get("Product"),
            "version": board_raw.get("Version"),
        },
        "bios": {
            "manufacturer": bios_raw.get("Manufacturer"),
            "version": bios_raw.get("SMBIOSBIOSVersion"),
            "release_date": bios_raw.get("ReleaseDate"),
        },
    }


@router.get("/hardware/storage")
def hardware_storage():
    disks = []
    for partition in psutil.disk_partitions(all=False):
        usage: Dict[str, Any] = {}
        try:
            u = psutil.disk_usage(partition.mountpoint)
            usage = {"total_bytes": u.total, "used_bytes": u.used, "free_bytes": u.free, "percent": u.percent}
        except Exception:
            pass
        disks.append({
            "device": partition.device,
            "mountpoint": partition.mountpoint,
            "fstype": partition.fstype,
            **usage,
        })
    return {"disks": disks}


@router.get("/hardware/network")
def hardware_network():
    adapters = []
    for name, addrs in psutil.net_if_addrs().items():
        ipv4 = next((a.address for a in addrs if a.family == socket.AF_INET), None)
        mac = next((a.address for a in addrs if a.family == psutil.AF_LINK), None)
        adapters.append({"name": name, "ipv4": ipv4, "mac": mac})
    io = psutil.net_io_counters()
    return {
        "adapters": adapters,
        "sent_bytes": io.bytes_sent,
        "recv_bytes": io.bytes_recv,
    }


class LargeFileScanRequest(BaseModel):
    path: str = ""
    min_mb: float = 200
    top_n: int = 40


@router.post("/cleanup/large-files")
def scan_large_files(req: LargeFileScanRequest):
    """扫描大文件（只读，不做删除；删除操作须由用户在文件管理器中自行处理）。"""
    root = req.path.strip() or get_system_drive() + "\\"
    if not os.path.isdir(root):
        raise HTTPException(status_code=400, detail="Invalid path")
    min_bytes = max(1.0, req.min_mb) * 1024 * 1024
    found: List[Dict[str, Any]] = []
    scanned = 0
    deadline = time.time() + 20
    for dirpath, _dirnames, filenames in os.walk(root):
        if time.time() > deadline and found:
            break
        for name in filenames:
            try:
                file_path = os.path.join(dirpath, name)
                size = os.path.getsize(file_path)
                scanned += 1
                if size >= min_bytes:
                    found.append({"path": file_path, "size_bytes": size})
                    if len(found) >= req.top_n * 3:
                        break
            except Exception:
                continue
        if len(found) >= req.top_n * 3 or time.time() > deadline:
            break
    found.sort(key=lambda item: item["size_bytes"], reverse=True)
    return {"root": root, "scanned": scanned, "files": found[: req.top_n], "truncated": time.time() > deadline}
