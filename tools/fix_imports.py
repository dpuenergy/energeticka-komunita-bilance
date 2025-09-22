# tools/fix_imports.py
from __future__ import annotations
import argparse, difflib, re, shutil
from pathlib import Path

# Kde budeme hledat soubory
ROOT = Path(__file__).resolve().parents[1]
PIPE = ROOT / "src" / "ec_balance" / "pipeline"
UTIL = ROOT / "src" / "ec_balance" / "utils"

TARGETS = [
    PIPE / "step1_wide_to_long.py",
    PIPE / "step2_local_pv.py",
    PIPE / "step3_sharing.py",
    PIPE / "step4a_batt_local_byhour.py",
    PIPE / "step4_batt_local.py",
    PIPE / "step4b_batt_econ.py",
    PIPE / "step5a_batt_central_byhour.py",
    PIPE / "step5_batt_central.py",
    PIPE / "step5_excel_econ.py",
    PIPE / "step6_excel_scenarios.py",
    UTIL / "sharing_lib.py",
    UTIL / "inspect_wide_headers.py",
    UTIL / "make_kwp_by_site.py",
]

# Náhrady importů
REPLACERS = [
    # stará cesta z dřívějšího projektu
    (re.compile(r"from\s+energo_pipeline\.scripts\.sharing_lib\s+import\s+([^\n]+)"),
     r"from ..utils.sharing_lib import \1"),
    # relativní import ze stejné složky na utils
    (re.compile(r"from\s+\.\s*sharing_lib\s+import\s+([^\n]+)"),
     r"from ..utils.sharing_lib import \1"),
    # holý import na modul -> relativní utils
    (re.compile(r"^import\s+sharing_lib\s*$", re.MULTILINE),
     r"from ..utils import sharing_lib"),
]

def fix_step3_try_except(txt: str) -> str:
    """
    U step3_sharing.py chceme, aby try/except import blok používal ..utils.sharing_lib.
    Jen opravíme importy; fallback funkci ponecháme.
    """
    # standardizuj 'from .sharing_lib import' -> '..utils.sharing_lib'
    txt = txt.replace("from .sharing_lib import", "from ..utils.sharing_lib import")
    # pokud někdo omylem psal 'from . import sharing_lib'
    txt = re.sub(r"from\s+\.\s+import\s+sharing_lib", "from ..utils import sharing_lib", txt)
    return txt

def apply_replacements(original: str) -> str:
    txt = original
    for pat, repl in REPLACERS:
        txt = pat.sub(repl, txt)
    return txt

def process_file(path: Path, apply: bool) -> bool:
    if not path.exists():
        return False
    original = path.read_text(encoding="utf-8")
    updated = apply_replacements(original)
    if path.name == "step3_sharing.py":
        updated = fix_step3_try_except(updated)

    if updated == original:
        print(f"[=] {path.relative_to(ROOT)} (bez změny)")
        return False

    # ukaž diff
    print(f"[~] {path.relative_to(ROOT)} – změny:")
    diff = difflib.unified_diff(
        original.splitlines(True),
        updated.splitlines(True),
        fromfile=str(path),
        tofile=f"{path} (updated)",
    )
    print("".join(diff))

    if apply:
        # záloha
        backup = path.with_suffix(path.suffix + ".bak")
        shutil.copy2(path, backup)
        path.write_text(updated, encoding="utf-8")
        print(f"[OK] Uloženo, záloha: {backup.name}")
    else:
        print("[i] Dry-run (pouze náhled). Spusť s --apply pro uložení.\n")
    return True

def main():
    ap = argparse.ArgumentParser(description="Oprav importy na ..utils.sharing_lib a sjednoť step3 try/except.")
    ap.add_argument("--apply", action="store_true", help="Provést změny (jinak jen diff).")
    args = ap.parse_args()

    any_change = False
    for p in TARGETS:
        try:
            changed = process_file(p, args.apply)
            any_change = any_change or changed
        except Exception as e:
            print(f"[ERR] {p}: {e}")

    if not any_change:
        print("Hotovo: Nebyly nalezeny žádné změny (nebo soubory).")

if __name__ == "__main__":
    main()
