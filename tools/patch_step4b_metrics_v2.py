# tools/patch_step4b_metrics_v2.py
from __future__ import annotations
from pathlib import Path
import difflib, shutil, re

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src" / "ec_balance" / "pipeline" / "step4b_batt_econ.py"

NEW_BODY = r'''
def _battery_metrics(bh: pd.DataFrame | None, cap_total_kwh: float | None):
    """
    Robustní metriky baterek:
      - umí různé názvy sloupců z kroků 4a/5a
      - vždy vrací čísla i když vstup není ideální
    """
    if bh is None or not isinstance(bh, pd.DataFrame) or bh.empty:
        return dict(efc=0.0, cycles_per_year=0.0, median_cycle_h=0.0,
                    lifetime_years_at_5000=np.inf, capacity_factor=0.0)

    # discharge – preferované názvy, fallback součet own+shared
    disc_col = _pick_col(bh, [
        "consumption_from_storage_kwh",
        "own_stored_kwh",
        "discharge_kwh",
        "energy_out_kwh",
    ])
    if disc_col is None and {"own_stored_kwh", "shared_stored_kwh"}.issubset(set(bh.columns)):
        disc_series = (
            pd.to_numeric(bh["own_stored_kwh"], errors="coerce").fillna(0.0)
            + pd.to_numeric(bh["shared_stored_kwh"], errors="coerce").fillna(0.0)
        )
    else:
        disc_series = pd.to_numeric(bh.get(disc_col, 0.0), errors="coerce")
        if not hasattr(disc_series, "fillna"):
            disc_series = pd.Series([float(disc_series)] * len(bh))
        disc_series = disc_series.fillna(0.0)

    # SOC – aliasy
    soc_col = _pick_col(bh, ["soc_kwh", "state_of_charge", "soc_kwh_sum"])
    soc_series = pd.to_numeric(bh.get(soc_col, 0.0), errors="coerce")
    if not hasattr(soc_series, "fillna"):
        soc_series = pd.Series([float(soc_series)] * len(bh))
    soc_series = soc_series.fillna(0.0)

    cap = float(cap_total_kwh or 0.0)
    if cap <= 0:
        cap = float(soc_series.max() or 1e-9)

    efc = float(disc_series.sum() / max(cap, 1e-9))
    hours = max(1, len(bh))
    cycles_per_year = efc * (8760.0 / hours)

    # hrubý odhad délky cyklu – lokální minima SOC
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
'''.lstrip("\n")

def main():
    if not TARGET.exists():
        raise SystemExit(f"Nenalezen soubor: {TARGET}")

    text = TARGET.read_text(encoding="utf-8")
    lines = text.splitlines(True)

    # Najdi začátek definice _battery_metrics
    start_idx = None
    for i, ln in enumerate(lines):
        if re.match(r"^def\s+_battery_metrics\s*\(", ln):
            start_idx = i
            break
    if start_idx is None:
        raise SystemExit("Nenalezena definice def _battery_metrics(...).")

    # Najdi první další top-level 'def ' po _battery_metrics (konec bloku)
    end_idx = None
    for j in range(start_idx + 1, len(lines)):
        if re.match(r"^def\s+\w+\s*\(", lines[j]):
            end_idx = j
            break
    if end_idx is None:
        raise SystemExit("Nenalezen konec bloku _battery_metrics (další def).")

    before = "".join(lines[:start_idx])
    after  = "".join(lines[end_idx:])
    updated = before + NEW_BODY + after

    if updated == text:
        print("[=] Bez změny (možná už je patch aplikován).")
        return

    # Diff náhled
    diff = difflib.unified_diff(
        text.splitlines(True), updated.splitlines(True),
        fromfile=str(TARGET), tofile=str(TARGET)+" (patched)"
    )
    print("".join(diff))

    # Záloha a zápis
    backup = TARGET.with_suffix(TARGET.suffix + ".bak2")
    shutil.copy2(TARGET, backup)
    TARGET.write_text(updated, encoding="utf-8")
    print(f"[OK] Uloženo. Záloha: {backup.name}")

if __name__ == "__main__":
    main()
