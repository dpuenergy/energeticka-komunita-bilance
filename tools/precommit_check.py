# SPDX-License-Identifier: AGPL-3.0-or-later
from __future__ import annotations
import sys, subprocess
from pathlib import Path

def main() -> int:
    root = Path(__file__).resolve().parents[1]
    csvdir = root / "out" / "csv"
    if not csvdir.exists():
        print("[pre-commit] out/csv nenalezen – ecb check přeskakuji.")
        return 0
    cmd = [sys.executable, "-m", "ec_balance.utils.check",
           "--csv_dir", str(csvdir), "--stage", "full"]
    print(f"[pre-commit] Spouštím: {' '.join(cmd)}")
    res = subprocess.run(cmd)
    return res.returncode

if __name__ == "__main__":
    raise SystemExit(main())
