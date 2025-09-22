# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2025 Kuba

# tools/patch_step1_normalize.py
from __future__ import annotations
from pathlib import Path
import re, difflib, shutil

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src" / "ec_balance" / "pipeline" / "step1_wide_to_long.py"

def ensure_detect_and_normalize(txt: str) -> str:
    out = txt

    # 1) Přidej detektor oddělovače (pokud tam není)
    if "_detect_sep(" not in out:
        detect_func = r"""
def _detect_sep(sample_path: str) -> str:
    try:
        with open(sample_path, "r", encoding="utf-8", errors="ignore") as f:
            head = f.readline() + f.readline()
    except Exception:
        return ","
    # víc středníků než čárek => ; jinak ,
    return ";" if head.count(";") > head.count(",") else ","
""".lstrip("\n")
        # vložíme hned po importech
        out = re.sub(r"(\n\s*import pandas as pd[^\n]*\n)", r"\1\n" + detect_func, out, count=1)

    # 2) Uprav popis parametru wide_sep v CLI, aby podporoval 'auto'
    out = re.sub(r'(--wide_sep", default=)"[^"]*"', r'\1"auto"', out)

    # 3) V _read_wide: když sep není daný nebo je 'auto', použij autodetekci
    out = re.sub(
        r"def _read_wide\(path: str, sep: str = \",\",",
        r"def _read_wide(path: str, sep: str | None = None,",
        out
    )
    out = re.sub(
        r'df = pd.read_csv\(path, sep=sep\)',
        (
            "if sep in (None, '', 'auto'):\n"
            "        sep = _detect_sep(path)\n"
            "    df = pd.read_csv(path, sep=sep)"
        ),
        out
    )

    # 4) V _wide_to_long: vždy převést čárky na tečky před numerikou
    out = re.sub(
        r'df\["value"\]\s*=\s*pd\.to_numeric\(df\["value"\], errors="coerce"\)\.fillna\(0\.0\)',
        'df["value"] = pd.to_numeric(df["value"].astype(str).str.replace(",", "."), errors="coerce").fillna(0.0)',
        out
    )

    return out

def main():
    if not TARGET.exists():
        raise SystemExit(f"Nenalezen soubor: {TARGET}")

    original = TARGET.read_text(encoding="utf-8")
    updated = ensure_detect_and_normalize(original)

    if original == updated:
        print("[=] Žádné změny nebyly potřebné (možná už je patch aplikován).")
        return

    # Diff pro kontrolu
    diff = difflib.unified_diff(
        original.splitlines(True), updated.splitlines(True),
        fromfile=str(TARGET), tofile=str(TARGET) + " (patched)"
    )
    print("".join(diff))

    # Záloha a zápis
    backup = TARGET.with_suffix(TARGET.suffix + ".bak")
    shutil.copy2(TARGET, backup)
    TARGET.write_text(updated, encoding="utf-8")
    print(f"[OK] Uloženo. Záloha: {backup.name}")

if __name__ == "__main__":
    main()
