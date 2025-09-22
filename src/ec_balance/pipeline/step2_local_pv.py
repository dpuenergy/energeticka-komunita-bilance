import argparse
from pathlib import Path
import pandas as pd
from ..utils.sharing_lib import local_pairing, safe_to_csv

def _load_csv(path: str | Path) -> pd.DataFrame:
    return pd.read_csv(path, parse_dates=["datetime"])

def _apply_site_map(df: pd.DataFrame, site_map: pd.DataFrame | None) -> pd.DataFrame:
    if site_map is None or site_map.empty:
        return df
    m = site_map.copy()
    if "site" not in m.columns or "site_group" not in m.columns:
        return df
    out = df.merge(m[["site","site_group"]], on="site", how="left")
    out["site"] = out["site_group"].fillna(out["site"])
    out = out.drop(columns=["site_group"], errors="ignore")
    return out

def main():
    ap = argparse.ArgumentParser(description="Krok 2 – lokální párování O↔D po objektu (site_group ze 2. řádku hlaviček)")
    ap.add_argument("--eano_long_csv", required=True)
    ap.add_argument("--eand_long_csv", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--pair_freq", default="H", help="časový bin pro párování: 'H', '30min', '15min', ...")
    ap.add_argument("--site_map_csv", default="", help="volitelně cesta k site_map.csv (jinak .\\csv\\site_map.csv)")
    args = ap.parse_args()

    outroot = Path(args.outdir)
    eano_long = _load_csv(args.eano_long_csv)
    eand_long = _load_csv(args.eand_long_csv)

    # načti site_map vytvořený v kroku 1 z 2. řádku wide hlaviček
    sm_path = Path(args.site_map_csv) if args.site_map_csv else (outroot / "csv" / "site_map.csv")
    site_map = pd.read_csv(sm_path) if sm_path.exists() else None

    # přemapuj na site_group (název objektu ze 2. řádku)
    eano_long = _apply_site_map(eano_long, site_map)
    eand_long = _apply_site_map(eand_long, site_map)

    # pairing BEZ canonicalizace (respektuj přesně site_group z mapy)
    eano_after, eand_after, local_self = local_pairing(
        eano_long, eand_long, freq=args.pair_freq, use_canonical=False
    )

    safe_to_csv(eano_after, outroot, name="eano_after_pv")
    safe_to_csv(eand_after, outroot, name="eand_after_pv")
    safe_to_csv(local_self, outroot, name="local_selfcons")

    sc_sum = float(pd.to_numeric(local_self["local_selfcons_kwh"], errors="coerce").fillna(0.0).sum())
    if sc_sum <= 0.0:
        print("[WARN] local_selfcons_kwh = 0. Zkontroluj:")
        print("  - že krok 1 vytvořil csv/site_map.csv ze 2. řádků hlaviček (a že sloupce O/D mají shodný text druhé řádky).")
        print("  - případně zkus jiný --pair_freq (např. '15min').")

if __name__ == "__main__":
    main()
