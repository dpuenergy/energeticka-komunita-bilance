# tools/fix_pyproject_dependencies.py
from __future__ import annotations
from pathlib import Path
import re, shutil, sys

ROOT = Path(__file__).resolve().parents[1]
PYP = ROOT / "pyproject.toml"

NEW_DEPS_BLOCK = (
    'dependencies = [\n'
    '  "pandas>=2.2",\n'
    '  "numpy>=1.26",\n'
    '  "pydantic>=2.8",\n'
    '  "click>=8.1",\n'
    '  "XlsxWriter>=3.2",\n'
    '  "PyYAML>=6"\n'
    ']\n'
)

def main():
    if not PYP.exists():
        sys.exit("Nenalezen pyproject.toml")

    txt = PYP.read_text(encoding="utf-8")

    # Zkontroluj, že máme sekci [project]
    if "[project]" not in txt:
        sys.exit("V pyproject.toml chybí [project] sekce – ručně zkontroluj soubor.")

    # Najdi multi-line pole dependencies = [ ... ]
    pat = re.compile(r'(?ms)^(\s*dependencies\s*=\s*\[).*?(\]\s*)', re.M)
    if not pat.search(txt):
        # Zkus přidat hned za [project] sekci
        txt = txt.replace("[project]", "[project]\n" + NEW_DEPS_BLOCK, 1)
        mode = "přidán nový blok"
    else:
        txt = pat.sub(NEW_DEPS_BLOCK, txt, count=1)
        mode = "nahrazen existující blok"

    bak = PYP.with_suffix(".toml.bak")
    shutil.copy2(PYP, bak)
    PYP.write_text(txt, encoding="utf-8")
    print(f"[OK] dependencies {mode}. Záloha: {bak.name}")

if __name__ == "__main__":
    main()
