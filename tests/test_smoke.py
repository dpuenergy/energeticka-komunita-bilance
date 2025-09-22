# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2025 Kuba

from pathlib import Path
import pandas as pd

def test_quick_import(tmp_path: Path):
    p = tmp_path / "in.csv"
    pd.DataFrame({
        "datetime": ["2025-01-01 00:00:00"],
        "site": ["A"],
        "value_kwh": [1.23],
    }).to_csv(p, index=False)
    df = pd.read_csv(p, parse_dates=["datetime"])
    assert len(df) == 1
