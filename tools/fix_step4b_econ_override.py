# tools/fix_step4b_econ_override.py
from __future__ import annotations
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src" / "ec_balance" / "pipeline" / "step4b_batt_econ.py"

OVERRIDE_SNIPPET = r'''
# --- override: robust _battery_metrics (appended) ---
# Pozn.: poslední definice ve file přepíše předchozí; nemusíme hrabat do discount/irr apod.
try:
    import pandas as pd  # noqa
except Exception:
    pass
try:
    import numpy as np  # noqa
except Exception:
    pass

def _battery_metrics(bh, cap_total_kwh):
    """
    Robustní metriky baterek pro různé názvy sloupců z kroků 4a/5a.
    - podporuje discharge: consumption_from_storage_kwh | own_stored_kwh | discharge_kwh | energy_out_kwh
      (když je own+shared, sečte je)
    - SOC: soc_kwh | state_of_charge | soc_kwh_sum
    - cap_total_kwh: když není >0, vezme max SOC jako odhad kapacity
    """
    # ochrany
    try:
        import pandas as pd  # local import, pokud nahoře selže
        import numpy as np
    except Exception:
        raise

    if bh is None:
        return dict(efc=0.0, cycles_per_year=0.0, median_cycle_h=0.0,
                    lifetime_years_at_5000=np.inf, capacity_factor=0.0)
    if not hasattr(bh, "empty") or bh.empty:
        return dict(efc=0.0, cycles_per_year=0.0, median_cycle_h=0.0,
                    lifetime_years_at_5000=np.inf, capacity_factor=0.0)

    cols = set(map(str, getattr(bh, "columns", [])))

    def pick(colnames):
        for c in colnames:
            if c in cols:
                return c
        return None

    # discharge
    disc_col = pick([
        "consumption_from_storage_kwh",
        "own_stored_kwh",
        "discharge_kwh",
        "energy_out_kwh",
    ])
    if disc_col is None and {"own_stored_kwh", "shared_stored_kwh"}.issubset(cols):
        disc_series = (
            pd.to_numeric(bh["own_stored_kwh"], errors="coerce").fillna(0.0)
            + pd.to_numeric(bh["shared_stored_kwh"], errors="coerce").fillna(0.0)
        )
    else:
        disc_raw = bh.get(disc_col, 0.0)
        disc_series = pd.to_numeric(disc_raw, errors="coerce")
        if not hasattr(disc_series, "fillna"):
            disc_series = pd.Series([float(disc_series)] * len(bh))
        disc_series = disc_series.fillna(0.0)

    # SOC
    soc_col = pick(["soc_kwh", "state_of_charge", "soc_kwh_sum"])
    soc_raw = bh.get(soc_col, 0.0)
    soc_series = pd.to_numeric(soc_raw, errors="coerce")
    if not hasattr(soc_series, "fillna"):
        soc_series = pd.Series([float(soc_series)] * len(bh))
    soc_series = soc_series.fillna(0.0)

    # kapacita
    cap = float(cap_total_kwh or 0.0)
    if cap <= 0:
        cap = float(soc_series.max() or 1e-9)

    efc = float(disc_series.sum() / max(cap, 1e-9))  # ekvivalent plných cyklů
    hours = max(1, len(bh))
    cycles_per_year = efc * (8760.0 / hours)

    # délka cyklu – hrubě dle lokálních minim SOC
    s = soc_series.to_numpy()
    mins = []
    for i in range(1, len(s) - 1):
        if s[i] <= s[i - 1] and s[i] <= s[i + 1]:
            mins.append(i)
    lengths = [mins[j+1] - mins[j] for j in range(len(mins)-1) if mins[j+1] - mins[j] > 0]
    median_cycle_h = float(np.median(lengths)) if lengths else 0.0

    lifetime_years = (5000.0 / cycles_per_year) if cycles_per_year > 0 else np.inf
    cap_factor = float(disc_series.sum() / (cap * 8760.0)) if cap > 0 else 0.0

    return dict(
        efc=efc,
        cycles_per_year=cycles_per_year,
        median_cycle_h=median_cycle_h,
        lifetime_years_at_5000=lifetime_years,
        capacity_factor=cap_factor,
    )
# --- end override ---
'''.lstrip("\n")

def main():
    if not TARGET.exists():
        raise SystemExit(f"Nenalezen soubor: {TARGET}")

    # 1) Obnov ze zálohy, pokud existuje .bak2 nebo .bak (abychom zrušili předchozí rozbité patche)
    for bakname in (TARGET.with_suffix(".py.bak2"), TARGET.with_suffix(".py.bak")):
        if bakname.exists():
            shutil.copy2(bakname, TARGET)
            print(f"[OK] Obnoveno ze zálohy: {bakname.name}")
            break

    txt = TARGET.read_text(encoding="utf-8")
    if "_battery_metrics(bh: pd.DataFrame | None" in txt and "override: robust _battery_metrics" in txt:
        print("[=] Override už je přidaný, nic nedělám.")
        return

    # 2) Přidej override na konec souboru
    if not txt.endswith("\n"):
        txt += "\n"
    txt += "\n" + OVERRIDE_SNIPPET
    TARGET.write_text(txt, encoding="utf-8")
    print(f"[OK] Přidán override na konec: {TARGET.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
