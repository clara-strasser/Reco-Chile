"""Shared pytest fixtures for the engine golden tests.

The calibration data is large and identical for every test, so it is loaded once
per session. Streamlit is imported transitively by ``sae_app.data_loading`` and
runs in "bare mode" here: its cache and session-state fallbacks work, they only
log warnings, which are muted below to keep test output readable.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TESTS_DIR.parent
for _path in (str(REPO_ROOT), str(TESTS_DIR)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import pandas as pd  # noqa: E402
import pytest  # noqa: E402


def _mute_streamlit_bare_mode_logging() -> None:
    """Silence bare-mode noise ("missing ScriptRunContext", "No runtime found").

    Streamlit installs its own handler and assigns a level to every logger it
    creates, so plain ``logging.getLogger("streamlit").setLevel`` is overwritten
    on the next Streamlit import. ``set_log_level`` is the switch Streamlit uses
    itself; the fallback covers versions where it disappears.
    """
    try:
        import streamlit.logger as streamlit_logger

        streamlit_logger.set_log_level("error")
    except Exception:  # pragma: no cover - depends on the Streamlit version
        logging.getLogger("streamlit").setLevel(logging.ERROR)


_mute_streamlit_bare_mode_logging()

from sae_app.constants import CAPACITIES_PATH  # noqa: E402
from sae_app.data_loading import load_calibration  # noqa: E402
from sae_app.program_options import build_program_mapping  # noqa: E402

from golden_runner import GOLDEN_DIR, build_id_maps  # noqa: E402

_mute_streamlit_bare_mode_logging()


@pytest.fixture(scope="session")
def calib() -> pd.DataFrame:
    """The merged calibration frame, loaded exactly as ``app.py`` loads it."""
    return load_calibration(CAPACITIES_PATH.read_bytes())


@pytest.fixture(scope="session")
def program_mapping(calib: pd.DataFrame) -> dict[str, pd.Series]:
    """Ordered ``display_label -> program row`` mapping (the wish-list join key)."""
    return build_program_mapping(calib)


@pytest.fixture(scope="session")
def id_maps(program_mapping: dict[str, pd.Series]) -> tuple[dict, dict]:
    """``(id_to_label, label_to_id)`` using ``program_id = f"{rbd}:{program_code}"``."""
    return build_id_maps(program_mapping)


@pytest.fixture(scope="session")
def golden_dir() -> Path:
    """Directory holding the committed golden fixtures."""
    return GOLDEN_DIR
