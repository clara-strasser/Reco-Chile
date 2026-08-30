"""Shared Streamlit-only display helpers.

format_display_table() is used by every part of the UI that shows a pandas
DataFrame to the family: it translates column headers and selected categorical
values without touching free-text columns such as school names or communes.

initialize_language_selector() lives here rather than in ``sae_app.i18n``
because it draws a widget: ``sae_app.i18n`` must stay importable without
Streamlit installed (see MIGRATION.md §5 item 2).

compact_order_label() / compact_tied_order_label() live here rather than in
``sae_app.wish_list`` for the same reason turned inside out: they build
*translated* display strings, and MIGRATION.md Phase 1 requires
``sae_app.wish_list`` to be language-free. They are prototype-only — the API
returns the structured ``tied_order`` (api.py) instead.
"""

from __future__ import annotations

import pandas as pd
import streamlit as st

from sae_app.constants import EQUIV_GROUP, PROGRAM
from sae_app.i18n import (
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    display_outcome_label,
    set_language,
    t,
)


def initialize_language_selector() -> None:
    """Create the language selector. Spanish is the default interface language.

    Streamlit reruns the whole script in a fresh thread on every interaction,
    and ``CURRENT_LANGUAGE`` is a ContextVar whose value does not leak between
    those threads. Setting it here — at the top of each script run, right after
    the widget is read — is therefore the correct request-scoping for the
    prototype: every subsequent ``t()`` in the same run picks up the selected
    language without any global mutable state.
    """
    if "lang" not in st.session_state:
        st.session_state["lang"] = DEFAULT_LANGUAGE

    options = list(SUPPORTED_LANGUAGES)
    current = st.session_state.get("lang", DEFAULT_LANGUAGE)
    if current not in options:
        current = DEFAULT_LANGUAGE

    lang_choice = st.sidebar.selectbox(
        "Idioma / Language",
        options=options,
        format_func=lambda x: "Español" if x == "es" else "English",
        index=options.index(current),
        key="language_selector_mtb",
    )
    st.session_state["lang"] = lang_choice
    set_language(lang_choice)


def format_display_table(df: pd.DataFrame) -> pd.DataFrame:
    """Translate display-only DataFrame headers and selected categorical values.

    Free-text columns such as school names, communes, program labels, and
    program details are intentionally left untouched. Only known categorical
    fields are translated, then column headers are translated.
    """
    out = df.copy()

    distance_cols = [
        "Straight-line distance from home (km)",
        "Straight-line distance from current list (km)",
    ]
    one_decimal_cols = [
        "Recommendation score",
    ]
    two_decimal_cols = [
        "Applicants / seat",
    ]
    integer_cols = [
        "Capacity",
        "Estimated MTB rank",
    ]

    for col in distance_cols:
        if col in out.columns:
            out[col] = out[col].map(
                lambda x: "" if pd.isna(x) or str(x).strip() == "" else f"{float(x):.1f} km"
            )

    for col in one_decimal_cols:
        if col in out.columns:
            out[col] = out[col].map(
                lambda x: "" if pd.isna(x) or str(x).strip() == "" else f"{float(x):.1f}"
            )

    for col in two_decimal_cols:
        if col in out.columns:
            out[col] = out[col].map(
                lambda x: "" if pd.isna(x) or str(x).strip() == "" else f"{float(x):.2f}"
            )

    for col in integer_cols:
        if col in out.columns:
            out[col] = out[col].map(
                lambda x: "" if pd.isna(x) or str(x).strip() == "" else f"{int(round(float(x)))}"
            )

    categorical_translation_cols = {
        "Criterion",
        "Dominant value in current list",
    }

    for col in out.columns:
        if col in {"Program", "Predicted outcome"}:
            out[col] = out[col].map(display_outcome_label)
        elif col == "Flagged at risk":
            out[col] = out[col].map(lambda x: t("Yes") if bool(x) else t("No"))
        elif col in categorical_translation_cols:
            out[col] = out[col].map(lambda x: t(x) if isinstance(x, str) else x)

    return out.rename(columns={col: t(col) for col in out.columns})


def compact_order_label(order_df: pd.DataFrame, max_items: int = 5) -> str:
    """Return a compact label for the complete strict order."""
    programs = [display_outcome_label(p) for p in order_df[PROGRAM].astype(str).str.strip().tolist()]
    if len(programs) <= max_items:
        return " → ".join(programs)
    return " → ".join(programs[:max_items]) + f" → … (+{len(programs) - max_items})"


def compact_tied_order_label(order_df: pd.DataFrame) -> str:
    """Return only the internal ordering of genuinely tied preference groups.

    Programs whose position is fixed across every compatible strict order are
    intentionally omitted. Multiple tied groups are separated with `` | `` so
    the UI can render each group independently.
    """
    if order_df.empty or EQUIV_GROUP not in order_df.columns:
        return compact_order_label(order_df)

    tied_groups: list[str] = []
    for _, group in order_df.groupby(EQUIV_GROUP, sort=True):
        if len(group) <= 1:
            continue
        programs = [
            display_outcome_label(program)
            for program in group[PROGRAM].astype(str).str.strip().tolist()
            if str(program).strip()
        ]
        if programs:
            tied_groups.append(" → ".join(programs))

    return " | ".join(tied_groups) if tied_groups else compact_order_label(order_df)
