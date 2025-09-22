# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2025 Kuba

# tools/add_spdx_headers.py
from __future__ import annotations
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[1]

DIRS = [
    ROOT / "src" / "ec_balance",
    ROOT / "tests",
    ROOT / "tools",
]

HEADER = """# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2025 Kuba

"""

def wants_header(text: str) -> bool:
    head = "\n".join(text.splitlines()[:5])
    return "SPDX-License-Identifier:" not in head

def process_file(p: Path, apply: bool) -> bool:
    txt = p.read_text(encoding="utf-8")
    if not wants_header(txt):
        print(f"[=] {p.relative_to(ROOT)}")
        return False
    new = HEADER + txt
    if apply:
        p.write_text(new, encoding="utf-8")
        print(f"[+] {p.relative_to(ROOT)}")
    else:
        print(f"[~] {p.relative_to(ROOT)} (dry-run)")
    return True

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Zapsat změny")
    args = ap.parse_args()

    changed = False
    for base in DIRS:
        if not base.exists():
            continue
        for p in base.rglob("*.py"):
            if p.is_file():
                ch = process_file(p, args.apply)
                changed = changed or ch

    if not changed:
        print("Hotovo: nic k úpravě.")

if __name__ == "__main__":
    main()
