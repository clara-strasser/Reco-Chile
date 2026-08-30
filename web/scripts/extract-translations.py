#!/usr/bin/env python
"""Dump the Streamlit prototype's translation table into JSON side-car files.

MIGRATION.md §4.3 and §10 ("next-intl semantic keys vs. prototype's
English-sentence keys → translations drift"): the Next.js frontend uses
semantic message IDs (``student.title``), while ``sae_app/i18n.py`` uses the
English source sentence itself as the key. This script is the bridge. It
writes two *source* files that are never loaded by the app:

    web/messages/_source.es.json   English source string -> Spanish translation
    web/messages/_source.en.json   English source string -> English text

They exist so that hand-authoring ``messages/es/*.json`` cannot silently lose a
Spanish sentence the prototype already had: every Spanish string in
``es/*.json`` should be copy-pasted from ``_source.es.json`` whenever the
prototype has an equivalent, and ``check`` mode below tells you which source
sentences are still unused.

Run with the project venv (system python3 on macOS is 3.9 and cannot import
the engine — see CLAUDE.md, "Python version")::

    /Users/clarastrasser/Reco-Chile/.venv/bin/python web/scripts/extract-translations.py
    /Users/clarastrasser/Reco-Chile/.venv/bin/python web/scripts/extract-translations.py --check

This is a one-off developer tool, not part of the build. It is safe to re-run:
it only rewrites the two ``_source.*.json`` files, never ``es/*.json`` /
``en.json``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
WEB_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = WEB_DIR.parent
MESSAGES_DIR = WEB_DIR / "messages"

# Import the engine from the repo root regardless of the current directory.
sys.path.insert(0, str(PROJECT_ROOT))

from sae_app.i18n import TRANSLATIONS  # noqa: E402  (needs the path insert above)


def build_source_tables() -> tuple[dict[str, str], dict[str, str]]:
    """Return ``(english, spanish)`` maps keyed by the prototype's own keys.

    The prototype's key *is* the English source string for every UI sentence,
    so the English table maps each key to itself. ``TRANSLATIONS["en"]`` holds
    the handful of genuinely symbolic keys (priority tiers), which map to their
    English label instead of to themselves.
    """
    symbolic = dict(TRANSLATIONS.get("en", {}))
    spanish_raw = dict(TRANSLATIONS.get("es", {}))

    english: dict[str, str] = {}
    spanish: dict[str, str] = {}

    for key in sorted(set(spanish_raw) | set(symbolic)):
        english[key] = symbolic.get(key, key)
        if key in spanish_raw:
            spanish[key] = spanish_raw[key]

    return english, spanish


def flat_values(node: object, out: list[str]) -> list[str]:
    """Collect every leaf string of a nested next-intl message tree."""
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, dict):
        for value in node.values():
            flat_values(value, out)
    elif isinstance(node, list):
        for value in node:
            flat_values(value, out)
    return out


def write_json(path: Path, payload: dict[str, str]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def report_unused(spanish: dict[str, str]) -> int:
    """Print prototype Spanish sentences that no hand-authored message reuses."""
    authored_dir = MESSAGES_DIR / "es"
    if not authored_dir.exists():
        print(f"{authored_dir} does not exist yet — nothing to check.")
        return 0

    used: set[str] = set()
    for authored in sorted(authored_dir.glob("*.json")):
        used |= set(flat_values(json.loads(authored.read_text(encoding="utf-8")), []))
    unused = [key for key, value in spanish.items() if value not in used]

    print(f"{len(spanish) - len(unused)}/{len(spanish)} prototype Spanish strings reused in es/*.json")
    if unused:
        print("\nNot reused (either intentionally dropped, or still to be carried over):")
        for key in unused:
            print(f"  - {key!r}\n      es: {spanish[key]!r}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--check",
        action="store_true",
        help="also list prototype Spanish strings that messages/es/*.json does not reuse",
    )
    args = parser.parse_args()

    MESSAGES_DIR.mkdir(parents=True, exist_ok=True)
    english, spanish = build_source_tables()

    write_json(MESSAGES_DIR / "_source.en.json", english)
    write_json(MESSAGES_DIR / "_source.es.json", spanish)

    print(f"wrote {MESSAGES_DIR / '_source.en.json'} ({len(english)} keys)")
    print(f"wrote {MESSAGES_DIR / '_source.es.json'} ({len(spanish)} keys)")

    if args.check:
        print()
        return report_unused(spanish)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
