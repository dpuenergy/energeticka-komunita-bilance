import sys
import click

def _forward_to(module_main, extra_args):
    old_argv = sys.argv[:]
    try:
        sys.argv = [sys.argv[0]] + list(extra_args)
        return module_main()
    finally:
        sys.argv = old_argv

@click.group()
def main():
    """CLI pro energetickou bilanci EK (sjednocené kroky).
    Příklad: ecb step3 --eano_after_pv_csv out/csv/eano_after_pv.csv ...
    """
    pass

def _subcmd(name, module_path):
    @main.command(name, context_settings=dict(ignore_unknown_options=True, allow_interspersed_args=False))
    @click.argument("args", nargs=-1, type=click.UNPROCESSED)
    def _runner(args):
        mod = __import__(module_path, fromlist=["main"])
        _forward_to(mod.main, args)
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
