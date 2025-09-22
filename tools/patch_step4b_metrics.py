# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2025 Kuba

# tools/patch_step4b_metrics.py
from __future__ import annotations
from pathlib import Path
import re, difflib, shutil

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src" / "ec_balance" / "pipeline" / "step4b_batt_econ.py"

def replace_battery_metrics(txt: str) -> str:
    pattern = re.compile(
        r"def _battery_metrics\(.*?\):.*?def discounted_cashflow",
        re.DOTALL
    )

    replacement = '''
def _battery_metrics(bh: pd.DataFrame | None, cap_total_kwh: float | None):
    # Robustní metriky pro různé názvy sloupců z kroků 4a/5a
    if bh is None:
        return dict(efc=0.0, cycles_per_year=0.0, median_cycle_h=0.0,
                    lifetime_years_at_5000=np.inf, capacity_factor=0.0)

    if not isinstance(bh, pd.DataFrame) or bh.empty:
        return dict(efc=0.0, cycles_per_year=0.0, median_cycle_h=0.0,
                    lifetime_years_at_5000=np.inf, capacity_factor=0.0)

    # Vyber sloupce: discharge a SOC
    # discharge – preferuj "consumption_from_storage_kwh", fallback "own_stored_kwh" + "shared_stored_kwh"
    disc_col = _pick_col(bh, ["consumption_from_storage_kwh","own_stored_kwh","discharge_kwh","energy_out_kwh"])
    if disc_col is None and set(["own_stored_kwh","shared_stored_kwh"]).issubset(set(bh.columns)):
        disc_series = pd.to_numeric(bh["own_stored_kwh"], errors="coerce").fillna(0.0) + \
                      pd.to_numeric(bh["shared_stored_kwh"], errors="coerce").fillna(0.0)
    else:
        disc_series = pd.to_numeric(bh.get(disc_col, 0.0), errors="coerce")
        if not hasattr(disc_series, "fillna"):
            # když je to skalar, udělej z něj sérii nul o délce df
            disc_series = pd.Series([float(disc_series)] * len(bh))
        disc_series = disc_series.fillna(0.0)

    soc_col = _pick_col(bh, ["soc_kwh","state_of_charge","soc_kwh_sum"])
    soc_series = pd.to_numeric(bh.get(soc_col, 0.0), errors="coerce")
    if not hasattr(soc_series, "fillna"):
        soc_series = pd.Series([float(soc_series)] * len(bh))
    soc_series = soc_series.fillna(0.0)

    cap = float(cap_total_kwh or 0.0)
    if cap <= 0:
        cap = float(soc_series.max() or 1e-9)

    efc = float(disc_series.sum() / max(cap, 1e-9))  # equivalent full cycles
    hours = max(1, len(bh))
    cycles_per_year = efc * (8760.0 / hours)

    # odhad délky cyklu – minima SOC
    s = soc_series.to_numpy()
    mins = []
    for i in range(1, len(s) - 1):
        if s[i] <= s[i - 1] and s[i] <= s[i + 1]:
            mins.append(i)
    lengths = [mins[j+1] - mins[j] for j in range(len(mins)-1) if mins[j+1] - mins[j] > 0]
    median_cycle_h = float(np.median(lengths)) if lengths else 0.0

    lifetime_years = (5000.0 / cycles_per_year) if cycles_per_year > 0 else np.inf
    cap_factor = float(disc_series.sum() / (cap * 8760.0)) if cap > 0 else 0.0

    return dict(efc=efc, cycles_per_year=cycles_per_year, median_cycle_h=median_cycle_h,
                lifetime_years_at_5000=lifetime_years, capacity_factor=cap_factor)

def discounted_cashflow(cashflows, rate):
'''.lstrip("\n")

    if not pattern.search(txt):
        raise SystemExit("Nepodařilo se najít blok _battery_metrics v step4b_batt_econ.py")

    return pattern.sub(replacement, txt, count=1)

def main():
    if not TARGET.exists():
        raise SystemExit(f"Nenalezen soubor: {TARGET}")

    original = TARGET.read_text(encoding="utf-8")
    updated = replace_battery_metrics(original)

    if original == updated:
        print("[=] Bez změny")
        return

    diff = difflib.unified_diff(
        original.splitlines(True), updated.splitlines(True),
        fromfile=str(TARGET), tofile=str(TARGET) + " (patched)"
    )
    print("".join(diff))

    backup = TARGET.with_suffix(TARGET.suffix + ".bak")
    shutil.copy2(TARGET, backup)
    TARGET.write_text(updated, encoding="utf-8")
    print(f"[OK] Uloženo. Záloha: {backup.name}")

if __name__ == "__main__":
    main()
