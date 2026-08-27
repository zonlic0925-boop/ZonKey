import os
import sys
import re
import subprocess
from pathlib import Path

def run_audit():
    print("=" * 60)
    print("1. 检查 Git 跟踪文件中的敏感 API Key / Secret / Token")
    print("=" * 60)
    
    SECRET_PATTERNS = [
        (r'(?i)(?:api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token|bearer)\s*[:=]\s*[\'\"]?([a-zA-Z0-9_\-\.]{16,})[\'\"]?', 'Secret/Token 键值'),
        (r'sk-[a-zA-Z0-9]{20,}', 'OpenAI / DeepSeek / Compatible API Key'),
        (r'sk-ant-[a-zA-Z0-9]{20,}', 'Anthropic API Key'),
        (r'ghp_[a-zA-Z0-9]{36}', 'GitHub Personal Access Token'),
        (r'gho_[a-zA-Z0-9]{36}', 'GitHub OAuth Token'),
        (r'AKIA[0-9A-Z]{16}', 'AWS Access Key ID'),
        (r'hf_[a-zA-Z0-9]{34}', 'HuggingFace Token'),
        (r'(?i)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', 'Private Key 私钥'),
    ]

    files = subprocess.check_output(['git', 'ls-files'], text=True).splitlines()
    found_secrets = []
    
    for f in files:
        p = Path(f)
        if not p.exists() or p.is_dir():
            continue
        try:
            content = p.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue
        for pat, label in SECRET_PATTERNS:
            for m in re.finditer(pat, content):
                val = m.group(0)
                # 排除误报
                if any(x in val.lower() for x in ['placeholder', 'example', 'dummy', 'none', 'self.', 'logger.', 'def ']):
                    continue
                found_secrets.append((f, label, val[:50]))

    print(f"已扫描 Git 跟踪文件: {len(files)} 个")
    if found_secrets:
        print("[!] 发现潜在密钥或 Token:")
        for f, label, snippet in found_secrets:
            print(f"  - {f}: [{label}] -> {snippet}")
    else:
        print("[√] 未在任何被跟踪源码或配置文件中发现 API Key、Token 或私钥！")

    print("\n" + "=" * 60)
    print("2. 检查个人隐私与绝对路径（如个人用户名、邮箱等）")
    print("=" * 60)
    
    PRIVACY_PATTERNS = [
        (r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '邮箱地址'),
        (r'[cC]:\\Users\\[a-zA-Z0-9_]+', '本地绝对路径/用户名'),
        (r'/Users/[a-zA-Z0-9_]+', 'Unix 用户绝对路径'),
        (r'\b(?:18\d|19\d|13\d|15\d|17\d)\d{8}\b', '手机号码'),
    ]
    
    found_privacy = []
    for f in files:
        # 跳过本检查脚本
        if "audit_public_safety" in f:
            continue
        p = Path(f)
        if not p.exists() or p.is_dir():
            continue
        try:
            content = p.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue
        for pat, label in PRIVACY_PATTERNS:
            for m in re.finditer(pat, content):
                val = m.group(0)
                # 允许公开说明性邮箱
                if 'users.noreply.github.com' in val or 'example.com' in val:
                    continue
                found_privacy.append((f, label, val))
                
    if found_privacy:
        print("[!] 发现个人隐私或绝对路径:")
        for f, label, snippet in found_privacy:
            print(f"  - {f}: [{label}] -> {snippet}")
    else:
        print("[√] 未在源码中发现个人邮箱、绝对路径或隐私信息！")

    print("\n" + "=" * 60)
    print("3. 检查 Git 历史 Commit 中的敏感信息")
    print("=" * 60)
    
    history_log = subprocess.check_output(['git', 'log', '-p'], text=True, errors='ignore')
    hist_secrets = []
    for pat, label in SECRET_PATTERNS:
        for m in re.finditer(pat, history_log):
            val = m.group(0)
            if any(x in val.lower() for x in ['placeholder', 'example', 'dummy', 'none', 'self.', 'logger.', 'def ']):
                continue
            hist_secrets.append((label, val[:50]))
            
    if hist_secrets:
        print("[!] Git 历史日志中发现潜在密钥:")
        for label, snippet in hist_secrets:
            print(f"  - [{label}] -> {snippet}")
    else:
        print("[√] Git 完整历史提交记录中无任何泄露的 API Key 或私钥！")

    print("\n" + "=" * 60)
    print("4. 检查是否有未忽略的 PDF / 客户样本")
    print("=" * 60)
    tracked_pdfs = [f for f in files if f.lower().endswith('.pdf')]
    if tracked_pdfs:
        print("[X] 错误：发现被 Git 跟踪的 PDF 文件:")
        for p in tracked_pdfs:
            print(f"  - {p}")
    else:
        print("[√] 确认无任何 PDF 客户图纸文件被 Git 跟踪！")

if __name__ == '__main__':
    run_audit()
