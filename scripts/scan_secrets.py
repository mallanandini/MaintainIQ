import subprocess
import re
import os

print("=== MaintainIQ Security & Secret Scanner ===")

tracked_files = subprocess.check_output(['git', 'ls-files'], text=True).splitlines()

suspicious_patterns = [
    (re.compile(r'mysql\+pymysql://[^:\s]+:([^@\s]+)@', re.I), 'MySQL connection string with credentials'),
    (re.compile(r'(api[_-]?key|secret|password|token)\s*[:=]\s*[\'\"](?!\s*[\'\"]|placeholder|your_|[A-Z_]+)[^\'\"]{6,}[\'\"]', re.I), 'Hardcoded secret/password/token'),
    (re.compile(r'BEGIN (RSA|OPENSSH|PGP|PRIVATE) KEY', re.I), 'Private Key Block')
]

findings = []
for f in tracked_files:
    if f.endswith(('.png', '.pdf', '.jpg', '.ico', '.woff', '.woff2', '.ttf')):
        continue
    if not os.path.isfile(f):
        continue
    try:
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            for line_no, line in enumerate(fp, 1):
                for pat, desc in suspicious_patterns:
                    m = pat.search(line)
                    if m:
                        matched = m.group(0).lower()
                        if 'example' in f.lower() or 'placeholder' in line.lower() or 'your_' in line.lower() or 'root:password@' in line.lower():
                            continue
                        # Ignore test mock data or schema types
                        if 'test' in f.lower() and ('password' in f.lower() or 'hash' in line.lower()):
                            continue
                        findings.append((f, line_no, desc))
    except Exception as e:
        pass

print(f"Tracked files scanned: {len(tracked_files)}")
if findings:
    print(f"WARNING: {len(findings)} potential secret(s) found in tracked files:")
    for f, l, d in findings:
        print(f"  {f}:{l} - {d}")
else:
    print("[PASS] No hardcoded secrets, connection strings, or private keys found in tracked files.")

print("\n=== Scanning Git Commit History ===")
proc = subprocess.run(['git', 'log', '-p'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
git_log_p = proc.stdout.decode('utf-8', errors='replace')
history_findings = []
for pat, desc in suspicious_patterns:
    for m in pat.finditer(git_log_p):
        matched_str = m.group(0)
        if 'example' in matched_str.lower() or 'placeholder' in matched_str.lower() or 'your_' in matched_str.lower() or 'root:password@' in matched_str.lower():
            continue
        history_findings.append((desc, matched_str[:25] + "..."))

if history_findings:
    print(f"WARNING: {len(history_findings)} potential secret(s) in git history:")
    for d, s in history_findings:
        print(f"  {d}: {s}")
else:
    print("[PASS] No secrets found in git commit history.")
