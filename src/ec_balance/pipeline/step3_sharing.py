# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2025 Kuba

import argparse
from pathlib import Path
from typing import List, Tuple
import pandas as pd
import numpy as np

# volitelnÄ› ÄŤteme safe_to_csv ze sharing_lib, ale mĂˇme i fallback
try:
    from ..utils.sharing_lib import safe_to_csv
except Exception:
    def safe_to_csv(df: pd.DataFrame, outdir: Path, name: str) -> Path:
        outdir = Path(outdir); (outdir / "csv").mkdir(parents=True, exist_ok=True)
        p = outdir / "csv" / f"{name}.csv"; df.to_csv(p, index=False); print(f"[OK] {name}: {p}"); return p

def _read(path: str, cols_required=None) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "datetime" in df.columns:
        df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")
    if cols_required:
        missing = [c for c in cols_required if c not in df.columns]
        if missing:
            raise ValueError(f"{path} chybĂ­ sloupce: {missing}")
    return df

def _sum_by_hour_site(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame(columns=["datetime","site",value_col])
    out = (
        df.groupby(["datetime","site"], as_index=False)[value_col]
          .sum()
          .sort_values(["datetime","site"])
          .reset_index(drop=True)
    )
    return out

def share_pool_degree_limited(
    eano_after: pd.DataFrame,
    eand_after: pd.DataFrame,
    *,
    max_recipients_per_from: int = 5,
    exclude_self: bool = True
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """ProporÄŤnĂ­ sdĂ­lenĂ­ po hodinĂˇch s omezenĂ­m poÄŤtu pĹ™Ă­jemcĹŻ na zdroj."""
    # agregace (robustnÄ› vĹŻÄŤi duplicitĂˇm)
    imp = _sum_by_hour_site(eano_after, "import_after_kwh")
    exp = _sum_by_hour_site(eand_after, "export_after_kwh")

    sites = sorted(set(imp["site"].unique()) | set(exp["site"].unique()))
    I = imp.pivot(index="datetime", columns="site", values="import_after_kwh").reindex(columns=sites, fill_value=0.0).fillna(0.0)
    E = exp.pivot(index="datetime", columns="site", values="export_after_kwh").reindex(columns=sites, fill_value=0.0).fillna(0.0)

    idx = I.index.union(E.index)
    I = I.reindex(idx, fill_value=0.0).astype(float)
    E = E.reindex(idx, fill_value=0.0).astype(float)

    alloc_rows: List[Tuple[pd.Timestamp, str, str, float]] = []
    resI_frames = []
    resE_frames = []

    for ts in idx:
        irow = I.loc[ts].astype(float)
        erow = E.loc[ts].astype(float)
        total_I = float(irow.sum()); total_E = float(erow.sum())
        if total_I <= 0 or total_E <= 0:
            resI_frames.append(irow.to_frame().T); resE_frames.append(erow.to_frame().T)
            continue

        shared = min(total_I, total_E)

        # cĂ­lovĂ© pokrytĂ­ a nabĂ­dka (proporÄŤnĂ­ k popt./nabĂ­dce)
        imp_share = (irow / total_I).fillna(0.0)
        exp_share = (erow / total_E).fillna(0.0)
        desired_cover = shared * imp_share       # kolik by ideĂˇlnÄ› dostal kaĹľdĂ˝ to_site
        supply_from   = shared * exp_share       # kolik by ideĂˇlnÄ› poslal kaĹľdĂ˝ from_site

        remaining_cover = desired_cover.copy()
        remaining_supply = supply_from.copy()

        # iteruj zdroje od nejvÄ›tĹˇĂ­ nabĂ­dky
        for s_from in remaining_supply.sort_values(ascending=False).index:
            s_supply = float(remaining_supply[s_from])
            if s_supply <= 1e-12:
                continue
            # kandidĂˇti: nejvÄ›tĹˇĂ­ zbĂ˝vajĂ­cĂ­ poptĂˇvka, volitelnÄ› bez self
            cand = remaining_cover.copy()
            if exclude_self and s_from in cand.index:
                cand = cand.drop(index=s_from)
            cand = cand[cand > 1e-12].sort_values(ascending=False)
            if cand.empty:
                continue
            selected = cand.head(max_recipients_per_from)
            sel_total = float(selected.sum())
            if sel_total <= 1e-12:
                continue
            # rozdÄ›l s_supply proporcionĂˇlnÄ› na vybranĂ© destinace
            for s_to, rem in selected.items():
                alloc = float(s_supply * (rem / sel_total))
                if alloc <= 0:
                    continue
                alloc_rows.append((ts, s_from, s_to, alloc))
                remaining_cover[s_to] = max(0.0, float(remaining_cover[s_to] - alloc))
            remaining_supply[s_from] = 0.0

        covered_by_site = (desired_cover - remaining_cover).clip(lower=0.0)
        contributed_by_site = (supply_from - remaining_supply).clip(lower=0.0)

        resI_frames.append((irow - covered_by_site).to_frame().T)
        resE_frames.append((erow - contributed_by_site).to_frame().T)

    I_res = pd.concat(resI_frames).sort_index()
    E_res = pd.concat(resE_frames).sort_index()

    imp_wide = I_res.reset_index().rename(columns={"index": "datetime"})
    exp_wide = E_res.reset_index().rename(columns={"index": "datetime"})
    allocations = pd.DataFrame(alloc_rows, columns=["datetime","from_site","to_site","shared_kwh"]).sort_values(["datetime","from_site","to_site"]).reset_index(drop=True)

    # souhrny
    pre_I = I.sum(axis=0).rename("import_local_kwh").to_frame()
    pre_E = E.sum(axis=0).rename("export_local_kwh").to_frame()
    post_I = I_res.sum(axis=0).rename("import_residual_kwh").to_frame()
    post_E = E_res.sum(axis=0).rename("export_residual_kwh").to_frame()
    rec_in = allocations.groupby("to_site")["shared_kwh"].sum().rename("shared_in_kwh").to_frame()
    rec_out= allocations.groupby("from_site")["shared_kwh"].sum().rename("shared_out_kwh").to_frame()

    by_site_after = (
        pd.concat([pre_I, pre_E, post_I, post_E, rec_in, rec_out], axis=1)
          .fillna(0.0)
          .reset_index().rename(columns={"index":"site"})
    )

    by_hour_after = (
        pd.DataFrame({
            "datetime": I.index,
            "import_local_kwh": I.sum(axis=1).values,
            "export_local_kwh": E.sum(axis=1).values,
            "import_residual_kwh": I_res.sum(axis=1).values,
            "export_residual_kwh": E_res.sum(axis=1).values,
        })
        .sort_values("datetime")
        .reset_index(drop=True)
    )

    return imp_wide, exp_wide, by_site_after, by_hour_after, allocations

def main():
    ap = argparse.ArgumentParser(description="Krok 3 â€“ sdĂ­lenĂ­ v komunitÄ› (pool, degree-limit)")
    ap.add_argument("--eano_after_pv_csv", required=True)
    ap.add_argument("--eand_after_pv_csv", required=True)
    ap.add_argument("--local_selfcons_csv", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--price_commodity_mwh", type=float, required=True)
    ap.add_argument("--price_distribution_mwh", type=float, required=True)
    ap.add_argument("--price_feed_in_mwh", type=float, required=True)
    ap.add_argument("--mode", choices=["hybrid","proportional"], default="hybrid")
    # aliasy: --max_receivers (pĹŻvodnĂ­) i --max_recipients (novĂ˝)
    ap.add_argument("--max_receivers", type=int, default=None, help="Max poÄŤet pĹ™Ă­jemcĹŻ na jeden zdroj v hodinÄ› (alias).")
    ap.add_argument("--max_recipients", type=int, default=None, help="Max poÄŤet pĹ™Ă­jemcĹŻ na jeden zdroj v hodinÄ› (alias).")
    ap.add_argument("--allow_self_pair", action="store_true", help="Povolit alokaci na tentĂ˝Ĺľ objekt (default: NE).")
    ap.add_argument("--site_map_csv", default="", help="(Kompatibilita CLI â€“ nevyuĹľito zde)")
    args = ap.parse_args()

    # vyber hodnotu limitu z aliasĹŻ
    max_rec = args.max_recipients if args.max_recipients is not None else (args.max_receivers if args.max_receivers is not None else 5)

    # naÄŤti vstupy (local_self zatĂ­m nevyuĹľĂ­vĂˇme pĹ™Ă­mo â€“ je jen meta)
    eano_after = _read(args.eano_after_pv_csv, cols_required=["datetime","site","import_after_kwh"])
    eand_after = _read(args.eand_after_pv_csv, cols_required=["datetime","site","export_after_kwh"])
    _ = _read(args.local_selfcons_csv)  # pro kontrolu existuje

    imp_wide, exp_wide, by_site_after, by_hour_after, allocations = share_pool_degree_limited(
        eano_after, eand_after,
        max_recipients_per_from=max_rec,
        exclude_self=(not args.allow_self_pair),
    )

    outroot = Path(args.outdir)
    safe_to_csv(by_site_after, outroot, name="by_site_after")
    safe_to_csv(by_hour_after, outroot, name="by_hour_after")
    safe_to_csv(allocations, outroot, name="allocations")
    safe_to_csv(imp_wide, outroot, name="imp_wide")
    safe_to_csv(exp_wide, outroot, name="exp_wide")

    print(f"[OK] Sharing hotovo. Limit pĹ™Ă­jemcĹŻ = {max_rec}, self_pair = {args.allow_self_pair}")

if __name__ == "__main__":
    main()
