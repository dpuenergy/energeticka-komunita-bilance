# tools/patch_outdir_csv.py
from __future__ import annotations
from pathlib import Path
import re, shutil, difflib

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    ROOT / "src" / "ec_balance" / "pipeline" / "step4a_batt_local_byhour.py",
    ROOT / "src" / "ec_balance" / "pipeline" / "step5a_batt_central_byhour.py",
]

SNIPPET = r'''
    # --- normalize outdir to end with /csv ---
    from pathlib import Path as _Path
    _out = _Path(args.outdir)
    if _out.name.lower() != "csv":
        _out = _out / "csv"
    _out.mkdir(parents=True, exist_ok=True)
    args.outdir = str(_out)
    print(f"[i] outdir -> {args.outdir}")
    # --- end normalize ---
'''

def patch_file(p: Path) -> None:
    if not p.exists():
        print(f"[i] skip (nenalezen): {p.relative_to(ROOT)}")
        return
    txt = p.read_text(encoding="utf-8")

    # vlož snippet hned po `args = ap.parse_args()`
    pat = re.compile(r'(args\s*=\s*ap\.parse_args\(\)\s*\n)', re.M)
    if not pat.search(txt):
        print(f"[!] {p.name}: nenašel jsem 'args = ap.parse_args()' – přeskočeno bez zásahu.")
        return
    new = pat.sub(r"\1" + SNIPPET, txt, count=1)

    if new == txt:
        print(f"[=] {p.name}: beze změny")
        return

    print(f"[~] {p.name}: diff náhled ↓")
    print("".join(difflib.unified_diff(txt.splitlines(True), new.splitlines(True),
                                       fromfile=str(p), tofile=str(p)+" (patched)")))
    bak = p.with_suffix(p.suffix + ".bak")
    shutil.copy2(p, bak)
    p.write_text(new, encoding="utf-8")
    print(f"[OK] Uloženo, záloha: {bak.name}")

def main():
    for t in TARGETS:
        patch_file(t)

if __name__ == "__main__":
    main()
