# tools/add_pyyaml_dep.py
from __future__ import annotations
from pathlib import Path
import re, shutil

ROOT = Path(__file__).resolve().parents[1]
PYP = ROOT / "pyproject.toml"

def main():
    txt = PYP.read_text(encoding="utf-8")

    if re.search(r'(?i)\bpyyaml\b', txt):
        print("[=] PyYAML už v pyprojectu je. Nic nedělám.")
        return

    # Najdi dependencies = [ ... ] (PEP621 v [project])
    m = re.search(r'(^\s*dependencies\s*=\s*\[)(.*?)(\]\s*)', txt, re.M | re.S)
    if not m:
        raise SystemExit("Nenašel jsem blok 'dependencies = [...]' v pyproject.toml")

    start, inside, end = m.group(1), m.group(2), m.group(3)

    # Vytvoř nový obsah uvnitř seznamu – přidáme řádek s PyYAML
    # Heuristika: udrž formát jako zbytek (odřádkování + odsazení 2 mezery).
    sep = "" if inside.strip() == "" else inside.rstrip() + "\n"
    new_inside = f"{sep}  \"PyYAML>=6\", \n"

    new_txt = txt[:m.start(2)] + new_inside + txt[m.end(2):]

    # záloha a zápis
    bak = PYP.with_suffix(".toml.bak")
    shutil.copy2(PYP, bak)
    PYP.write_text(new_txt, encoding="utf-8")
    print(f"[OK] Přidáno 'PyYAML>=6' do dependencies. Záloha: {bak.name}")

if __name__ == "__main__":
    main()
