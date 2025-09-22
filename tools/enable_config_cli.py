# tools/enable_config_cli.py
from __future__ import annotations
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1]
PYPROJECT = ROOT / "pyproject.toml"
CLI = ROOT / "src" / "ec_balance" / "cli.py"
UTILS_DIR = ROOT / "src" / "ec_balance" / "utils"
CONFIG_PY = UTILS_DIR / "config.py"

def ensure_pyyaml():
    txt = PYPROJECT.read_text(encoding="utf-8")
    if "pyyaml" in txt.lower():
        print("[=] PyYAML už v pyprojectu je.")
        return
    # najdi dependencies = [ ... ]
    pat = re.compile(r"(?ms)^dependencies\s*=\s*\[(.*?)\]")
    m = pat.search(txt)
    if not m:
        raise SystemExit("Nenašel jsem blok [project] dependencies v pyproject.toml")
    inside = m.group(1).strip()
    new_inside = (inside + (",\n  " if inside else "") + '"PyYAML>=6"')
    new = txt[:m.start(1)] + new_inside + txt[m.end(1):]
    PYPROJECT.write_text(new, encoding="utf-8")
    print("[+] Přidáno PyYAML do dependencies.")

def write_config_py():
    UTILS_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PY.write_text(
        """# SPDX-License-Identifier: AGPL-3.0-or-later
# Jednoduchý loader YAML configu pro ecb. Precedence: CLI > step > global > defaults.

from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Iterable, List

def load_yaml(path: str | None) -> dict:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        print(f"[i] config: soubor nenalezen: {p}")
        return {}
    try:
        import yaml  # type: ignore
    except Exception:
        print("[i] config: PyYAML není nainstalováno (pip install PyYAML)")
        return {}
    with p.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        print("[i] config: YAML není slovník – ignoruji.")
        return {}
    return data

def _flat_kv(d: dict | None) -> List[tuple[str, Any]]:
    if not isinstance(d, dict):
        return []
    # jen primitivní hodnoty – True/False -> 'true'/'false'; list -> comma-joined
    out: List[tuple[str, Any]] = []
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, bool):
            v = "true" if v else "false"
        elif isinstance(v, (list, tuple)):
            v = ",".join(map(str, v))
        else:
            v = str(v)
        out.append((str(k).replace("_", "-"), v))
    return out

def kv_to_argv(d_global: dict | None, d_step: dict | None) -> List[str]:
    """
    Vytvoř list argv pro argparse: ['--key','value', ...]
    Pořadí: global -> step (step přepíše global), CLI přijde až nakonec a přepíše oboje.
    """
    argv: List[str] = []
    for k, v in _flat_kv(d_global):
        argv += [f"--{k}", v]
    for k, v in _flat_kv(d_step):
        argv += [f"--{k}", v]
    return argv
""",
        encoding="utf-8",
    )
    print("[+] Vytvořen utils/config.py")

def write_cli_py():
    CLI.write_text(
        r'''# SPDX-License-Identifier: AGPL-3.0-or-later
import sys
import click
from .utils.config import load_yaml, kv_to_argv

def _forward_to(module_main, extra_args, passthrough_args):
    # Složíme argv: nejdřív YAML (global -> step), pak CLI (CLI má prioritu)
    old_argv = sys.argv[:]
    try:
        sys.argv = [sys.argv[0]] + list(extra_args) + list(passthrough_args)
        return module_main()
    finally:
        sys.argv = old_argv

@click.group()
@click.option("--config", type=click.Path(exists=True, dir_okay=False, path_type=str), default=None,
              help="YAML s defaulty. Sekce 'global' + sekce s názvem kroku (step1, step2,...).")
@click.pass_context
def main(ctx, config):
    """CLI pro energetickou bilanci EK (sjednocené kroky).
    Příklad:
      ecb step3 --config examples/config.yaml --max_recipients 5
    """
    ctx.ensure_object(dict)
    ctx.obj["config_path"] = config

def _subcmd(name, module_path):
    @main.command(name, context_settings=dict(ignore_unknown_options=True, allow_interspersed_args=False))
    @click.argument("args", nargs=-1, type=click.UNPROCESSED)
    @click.pass_context
    def _runner(ctx, args):
        cfg = load_yaml(ctx.obj.get("config_path"))
        extra = kv_to_argv(cfg.get("global"), cfg.get(name))
        mod = __import__(module_path, fromlist=["main"])
        _forward_to(mod.main, extra, args)
    return _runner

_subcmd("step1", "ec_balance.pipeline.step1_wide_to_long")
_subcmd("step2", "ec_balance.pipeline.step2_local_pv")
_subcmd("step3", "ec_balance.pipeline.step3_sharing")
_subcmd("step4a", "ec_balance.pipeline.step4a_batt_local_byhour")
_subcmd("step4b-econ", "ec_balance.pipeline.step4b_batt_econ")
_subcmd("step5a", "ec_balance.pipeline.step5a_batt_central_byhour")
_subcmd("step5", "ec_balance.pipeline.step5_batt_central")
_subcmd("step6", "ec_balance.pipeline.step6_excel_scenarios")

if __name__ == "__main__":
    main()
''',
        encoding="utf-8",
    )
    print("[+] Přepsán cli.py s podporou --config")

def main():
    ensure_pyyaml()
    write_config_py()
    write_cli_py()
    print("\n[i] Hotovo. Teď proveď 'pip install -e .' a vyzkoušej 'ecb --help' a '--config'.")
if __name__ == "__main__":
    main()
