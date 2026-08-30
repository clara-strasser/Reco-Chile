# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Migration in progress

The Streamlit UI is being replaced by a Next.js + shadcn/ui wizard in `web/`,
with FastAPI (`api.py`) as the only backend. **`MIGRATION.md` is the source of
truth** for decisions, the API contract, the wizard/state design, the phase
plan, and the phase log. Before touching anything, check which phase is
active in `MIGRATION.md` §9 and stay inside that phase's scope and
"must not touch" list.

Decisions that are locked (do not re-open them in code or comments):

- Python `sae_app/` stays the calculation engine; nothing numerical is ported to TypeScript.
- Monorepo: `web/` next to `sae_app/`; TS API types are generated from the FastAPI OpenAPI schema, never hand-written.
- Four wizard steps: Student → Build list → Result → Improve.
- Streamlit stays runnable as the parity reference until Phase 7 deletes it.
- Phases are executed as one `Workflow` run each with Opus 5 agents and a human gate between phases (`MIGRATION.md` §8).

## Commands

### Python (engine + API)

```bash
python -m venv .venv && source .venv/bin/activate
python -m pip install -r requirements.txt          # + requirements-dev.txt once Phase 0 lands

python -m streamlit run app.py     # Streamlit UI (parity reference until Phase 7)
uvicorn api:app --reload           # FastAPI JSON API — the backend for web/
pytest                             # engine golden tests + API contract tests (from Phase 0)
python scripts/export_openapi.py   # regenerate web/lib/api/openapi.json (from Phase 1)
```

Until Phase 0 lands there is no test suite, linter config, or CI; verify by
running the app. From Phase 0 on, `pytest` must stay green — the golden
fixtures under `tests/fixtures/golden/` define numerical parity and are
regenerated only by an explicit decision recorded in `MIGRATION.md`.

### Web (from Phase 2)

```bash
cd web
pnpm install
pnpm dev                           # expects API_BASE_URL (default http://localhost:8000)
pnpm build && pnpm lint && pnpm test && pnpm e2e
```

Node ≥ 20 (26 installed via Homebrew) and pnpm 11 are required. `pnpm e2e` starts
both uvicorn (from the repo `.venv`) and `next dev` itself.

### Python version

Requires Python 3.10+, pinned to `3.12` in `.python-version` (read by pyenv, uv,
mise, and asdf alike — the file is intentionally tool-neutral, and a partial
`3.12` rather than an exact patch version).

This matters on macOS: `/usr/bin` precedes `/opt/homebrew/bin` in a default PATH,
so a bare `python3` is system Python 3.9, and `api.py` cannot import under it —
its pydantic models use PEP 604 unions (`int | None`) with
`from __future__ import annotations`, so pydantic evaluates them as strings at
runtime and 3.9 raises `TypeError`. Use the pyenv shim (`python`), not `python3`.

Dependencies are plain `requirements.txt` with `>=` lower bounds, deliberately —
no lockfile, no project-manager config, so collaborators are not pushed onto any
one tool. The tradeoff is that installs are not reproducible: a fresh install
currently resolves to pandas 3.x and numpy 2.x. The engine has been smoke-tested
against pandas 3.0.5 / numpy 2.5.2 / scipy 1.18.0 on Python 3.12.13.

Set `APP_DEBUG = True` in `sae_app/constants.py` to surface full tracebacks in the Streamlit UI (`st.exception`) instead of the generic error message.

## Architecture

Two entry points sit on top of one shared calculation core in `sae_app/`:

- `app.py` — Streamlit page orchestration only. It reads/validates the calibration CSVs, builds the program mapping, renders each numbered section, and calls into `sae_app`. No calculation logic belongs here. Scheduled for deletion in Phase 7.
- `api.py` — thin HTTP adapter over the same engine and the backend of `web/`. It always runs the equivalence-class pipeline: a wish without an explicit `equivalence_group` becomes a singleton group equal to its position, which is mathematically identical to strict ranking, so one code path covers both modes.
- `web/` (from Phase 2) — Next.js App Router, shadcn/ui, next-intl, zustand. It formats and explains; it never computes a probability. All thresholds and option lists come from `GET /meta`, nothing is hard-coded.

`README.md` documents the risk model in detail (MTB hash → priority-adjusted rank → hypergeometric availability → cumulative assignment probability). Read it before changing anything in `mtb_engine.py`.

### The program label is the join key (engine) — the program id is the join key (wire)

`build_program_mapping(calib)` returns an ordered `dict[display_label, pd.Series]`. That human-readable display label — not the RBD or program code — is what wish-list DataFrames store in the `PROGRAM` column, and it is how every downstream lookup finds a program row. Label construction (`make_program_option_label`) disambiguates duplicates by appending detail and finally `· code <program_code>`, so labels are stable within a single loaded dataset but change if the data or labelling rules change. `app.py` handles labels that vanish from the data by dropping them from the wish list with a warning.

`api.py` layers a stable public identifier over this: `program_id = f"{rbd}:{program_code}"`, with `id_to_label` / `label_to_id` dicts built at startup. HTTP callers — including `web/` — never see labels except as `program_label`, and `web/` stores only `program_id`s.

### Streamlit coupling

The docstrings describe the engine as Streamlit-free, which is true today only of `constants`, `errors`, `text_utils`, `mtb_engine`, `wish_list`, and `program_options`. `data_loading`, `geo`, `recommendations`, `i18n`, `session_state`, and all `ui_*` modules import `streamlit` — mostly for `@st.cache_data` and `st.session_state`. `api.py` therefore still pulls Streamlit in transitively through `data_loading`.

Phase 1 removes this coupling (`sae_app/cache.py`, explicit `lang` parameter, per-request `CandidateRiskCache`). Until then and after: keep new pure-calculation code in the Streamlit-free modules, and never add a new `import streamlit` outside `app.py`, `ui_*`, `session_state.py`, and `ui_common.py`.

### Caching

`load_calibration` / `_load_calibration` and the geo loaders are cached with `@st.cache_data` keyed on **file bytes**, not paths — that is why `load_calibration` reads and passes the bytes of all four CSVs explicitly. Recommendation candidate metrics use a separate manual cache in `recommendations.py`; clear it with `clear_candidate_risk_cache()` whenever the student identifier changes. Its key deliberately excludes the student identifier — keep it that way when the cache moves to `sae_app/cache.py`.

### i18n contract

Two layers, one rule each:

- **Python (`sae_app/i18n.py`)**: English source strings *are* the translation keys. `t("Some English text")` looks the string up in `TRANSLATIONS["es"]` and falls back to the key unchanged when missing. Spanish is the default. Any new or edited user-facing English string needs a matching `es` entry keyed by the exact English text; editing an English string silently breaks its Spanish translation. Dropdown/radio values stay in English internally; `format_option_label` translates only the display. After Phase 1 `t()` takes an explicit `lang` and is used only for API error messages.
- **Web (`web/messages/{es,en}.json`)**: semantic keys (`result.attention.high`), both files must have identical key sets (a Vitest test enforces this). Enumerated API values (filter options, priority tiers, `Unmatched`) are translated under `enums.*`; school names, communes, and program display names are shown verbatim; API `message` fields are shown as-is.

The API never returns translated enumerated values — only `message` is language-dependent (`?lang=` / `Accept-Language`, default `es`).

### Error handling

`MtbEngineError` subclasses (`sae_app/errors.py`) carry a `message_key` plus `message_kwargs` and are **not** pre-translated. The presentation layer translates them: `translate_engine_error` in `app.py`, `_engine_error` in `api.py` (which returns 422 with `{error_key, message, params}`). Raise typed engine errors from calculation code; never call `t()` there. `web/` shows `message` and may branch on `error_key` (e.g. `too_many_equivalence_orders`).

### Column names and thresholds

Every data column name, threshold, file path, and filter option list lives in `sae_app/constants.py`. Use the constants (`PROGRAM`, `WISH_RANK`, `EQUIV_GROUP`, `CAPACITY`, `POP`, …), not string literals — the CSV column names do not match the Python identifiers. `web/` reads thresholds and option lists from `GET /meta`; duplicating a constant in TypeScript is a bug.

### Equivalence-class pipeline

Availability depends only on the program and the student's priority flags, never on list position. So the flow is: `prepare_ordered_wishes` → `count_equivalence_orders` (rejected above `MAX_EXACT_EQUIV_PERMUTATIONS = 10000`) → `precompute_equivalence_availability` once, keyed by `wish_availability_cache_key(wish) = (program_label, priority_flags)` → `iter_equivalence_orders` → `compute_equivalence_order_from_precomputed` per permutation, which only recomputes the cumulative products. Do not call `availability()` inside the permutation loop.

### State invalidation (both UIs)

Derived results must be explicitly discarded when an input that affects them changes. The rules are listed once, in `MIGRATION.md` §4.2, and implemented twice: `invalidate_simulation_state` + callbacks in `app.py` (Streamlit) and the zustand store in `web/lib/store/wizard.ts`. The wish list itself is deliberately preserved across mode changes. Any new input that affects results needs the same treatment in both places (until Phase 7) and a row in that table.

### Data validation

`app.py` runs `required_cols()`, `validate_core_numeric_columns`, and `validate_cumulative_share_columns` after loading and calls `st.stop()` on failure. `api.py` runs the same three checks in `validate_calibration` at lifespan and raises `RuntimeError` so uvicorn refuses to start on bad data.

## Web conventions (from Phase 2)

- Wizard pages live under `web/app/[locale]/(wizard)/{student,list,result,improve}/page.tsx`; the step guard and stepper live in the group layout. A step is reachable only under the conditions in `MIGRATION.md` §4.1.
- shadcn primitives go in `web/components/ui/` (generated, do not hand-edit); wizard components in `web/components/wizard/`.
- The browser calls FastAPI only through the proxy route handler `web/app/api/[...path]/route.ts`; never hard-code the Python origin in client code, and never log request bodies in the proxy.
- `studentId`, the simulation result, and the geocoded home are never persisted (no `localStorage`/`sessionStorage`, no URL params). Only wishes, mode flags, and filters go to `sessionStorage`.
- The address is sent to `/geocode` only on explicit button click.
- Strict-mode reordering offers drag-and-drop **and** up/down buttons; keyboard operability is a requirement, not a nice-to-have.

## Working with the migration workflow

- One `Workflow` run per phase, script shape in `MIGRATION.md` §8, every agent with `model: 'opus'`.
- Work items in one run must touch disjoint files (worktree isolation); split otherwise.
- After a run: append the run id and gate result to `MIGRATION.md` §9. Do not start the next phase without a human review of the gate and review output.
- Golden fixtures are regenerated only with an explicit note in §9 explaining why the numbers were allowed to change.

## Tests

`tests/golden_runner.py` is the single implementation of "drive the engine the way `app.py` / `ui_recommendations.py` do" and is shared by `tests/generate_golden.py` and the golden tests. When the engine's calling convention changes (Phase 1: explicit `lang`, `CandidateRiskCache`), update the runner — never the fixtures. Regenerating `tests/fixtures/golden/` requires a note in `MIGRATION.md` §9 in the same commit (see the README there).

## Privacy constraints in the code

The RUN/IPE is used only to compute `SHA-256(normalized_id + normalized_rbd)`; the hash input and hex digest are local temporaries and are deliberately never attached to a DataFrame (`attach_mtb_hashes` even drops legacy `lottery_hash_input` / `lottery_hash_hex` columns, and `migrate_legacy_sensitive_state` purges old session state once). Preserve this when touching `mtb_engine.py`. The only outbound network call is Nominatim geocoding, throttled to 1 req/s per process by `geo.py` and triggered only by an explicit user action. The same rules apply to `web/` (see Web conventions).
