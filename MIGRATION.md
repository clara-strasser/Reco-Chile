# Migration: Streamlit → Next.js + shadcn/ui

Status: **in progress** — Phases 0–5 done; see §9. This document is the single source of truth
for the migration. It is written so that each phase can be handed to an
autonomous agent (Opus 5) as one well-scoped unit of work, with a verifiable
gate before the next phase starts.

Companion docs: `README.md` (risk model, data files), `CLAUDE.md` (conventions
for working in this repo, including the post-migration layout).

---

## 0. Decisions (locked)

| Topic | Decision | Consequence |
| --- | --- | --- |
| Calculation engine | **Python stays the source of truth.** FastAPI is extended, not replaced. | No numerical logic is ported to TypeScript. The frontend never computes a probability. |
| Repo layout | **Monorepo.** Next.js lives in `web/` next to `sae_app/`. | One PR flow; TypeScript API types are generated from the FastAPI OpenAPI schema. |
| Wizard | **4 steps, mirroring the prototype's numbering**: 1 Student · 2 Build list · 3 Result · 4 Improve. | Mode choices ("list exists?", "undecided ties?") stay in step 1. Step 4 feeds back into step 2. |
| Streamlit | **Kept until parity, then removed** (Phase 7). | Streamlit is the parity reference. `app.py`, `sae_app/ui_*`, `session_state.py`, `.streamlit/` are deleted in the last phase. |
| Execution | Phases run as **Workflow runs with Opus 5 agents**, one workflow per phase, human gate between phases. | See §8. |
| UI language | Spanish default, English switchable — unchanged. | Translations move from `sae_app/i18n.py` to `web/messages/{es,en}.json`; the API keeps a Streamlit-free `t()` for error messages only. |

Assumptions made without asking (change here if wrong):

- Hosting target is "one container per service" (FastAPI + Next.js), fronted by
  a reverse proxy on one origin. Vercel for `web/` is also possible; nothing
  in the plan depends on it.
- Package manager: **pnpm**. Node ≥ 20 LTS. Node is currently *not* installed
  on the development machine (`which node` → nothing); Phase 2 starts with
  installing it.
- Next.js App Router, React Server Components where they are free, but the
  wizard itself is a client component tree (it is all interactive state).

---

## 1. Current state (inventory)

### 1.1 What the prototype does — one page, four sections

`app.py` renders everything top-to-bottom on every Streamlit rerun:

1. **Identify the student** — RUN/IPE input (validated with modulo-11 /
   IPE rules, `mtb_engine.normalize_student_identifier`), "why do we ask"
   popover, radio *"list exists? Yes/No"*, toggle *"undecided order between
   some programs"* (equivalence-class mode).
2. **Build and order the list** — when *No*: region select + track
   checkboxes + expander with 9 multiselect filters; always: searchable
   program select + Add button; wish cards with rank / group number, program
   details popover, priority expander (4 SAE priorities + "already enrolled"),
   Remove, Move up/down (strict mode only). Notice when a selected program
   uses imputed calibration.
3. **Review the result** — order count caption (equivalence mode), primary
   button *Analyze*, metric (unmatched risk), 3-level attention alert, top-4
   outcomes + expander for all, family table, interpretation popovers,
   detailed calculation table; in equivalence mode additionally the
   sensitivity verdict (3 cases), per-order cards (≤12) or grouped tables,
   and technical tables.
4. **Improve the list** — current risk metric, address input + *Use this
   address* / *Clear*, geocoding precision feedback, slider 2–10, one card per
   recommendation (school, location, distance, projected risk badge in
   green/orange/red, chance if reached, calculation popover, checkbox),
   *Add selected and review* → appends to the list, invalidates the
   simulation, shows a success notice at the top of section 2.

### 1.2 Streamlit coupling that blocks the API today

| Module | Coupling | Needed by API? |
| --- | --- | --- |
| `sae_app/data_loading.py` | `@st.cache_data` on 4 loaders | yes |
| `sae_app/geo.py` | `@st.cache_data` on commune lookup and `geocode_chilean_address` (24 h TTL) | yes |
| `sae_app/recommendations.py` | `st.session_state` as the candidate-risk cache | yes |
| `sae_app/i18n.py` | `t()` reads `st.session_state["lang"]`; `initialize_language_selector` draws the sidebar | yes (`t()` for error messages) |
| `sae_app/session_state.py`, `ui_*` | pure Streamlit | no — deleted in Phase 7 |

Streamlit-free already: `constants`, `errors`, `text_utils`, `mtb_engine`,
`wish_list` (imports `i18n.t`, so it becomes free once `i18n` is),
`program_options`.

### 1.3 Known defects to fix first

- ~~`api.py:51` imports `build_options` which does not exist~~ — fixed in Phase 0.
- ~~`api.py` skips the startup validations `app.py` runs~~ — fixed in Phase 0
  (`validate_calibration` raises `RuntimeError` at lifespan).
- `api.py` only exposes `/regions`, `/programs` (region + free text) and
  `/simulate`. No filters, no recommendations, no geocoding, no thresholds.
- No tests anywhere. Parity cannot be proven without them.

---

## 2. Target architecture

```
browser ──HTTP/JSON──▶ web/ (Next.js, shadcn/ui)      ──HTTP/JSON──▶ api.py (FastAPI)
                        · wizard state (client)                       · sae_app/ engine
                        · i18n (next-intl, es/en)                      · in-process caches
                        · generated API client                         · Nominatim (geocode only)
```

- The browser talks to the FastAPI service through Next.js **route handlers**
  under `web/app/api/[...path]/route.ts` that proxy to `API_BASE_URL`.
  Reason: one origin (no CORS in production), the RUN/IPE never leaves the
  first-party origin from the browser's point of view, and the Python port is
  not exposed publicly. In development the proxy points at
  `http://localhost:8000`.
- FastAPI stays stateless per request. All calibration data is loaded once at
  startup (`lifespan`), validated, and kept in `STATE`.
- The engine remains the *only* place probabilities are computed. The frontend
  formats and explains; it never recomputes cumulative products.

### 2.1 Repository layout after Phase 2

```
Reco-Chile/
├── api.py                  # FastAPI adapter (extended)
├── app.py                  # Streamlit — deleted in Phase 7
├── sae_app/                # engine (Streamlit-free after Phase 1)
│   ├── cache.py            # NEW: tiny in-process cache replacing st.cache_data
│   └── ...
├── tests/                  # NEW: pytest — engine golden tests + API contract tests
│   ├── fixtures/golden/    # JSON fixtures generated from the pre-migration engine
│   └── ...
├── data/
├── web/                    # NEW: Next.js app
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx
│   │   │   └── (wizard)/
│   │   │       ├── layout.tsx          # stepper + step guard
│   │   │       ├── student/page.tsx    # step 1
│   │   │       ├── list/page.tsx       # step 2
│   │   │       ├── result/page.tsx     # step 3
│   │   │       └── improve/page.tsx    # step 4
│   │   └── api/[...path]/route.ts      # proxy to FastAPI
│   ├── components/ui/                  # shadcn primitives (generated)
│   ├── components/wizard/              # step components, cards, stepper
│   ├── lib/api/                        # generated client + typed wrappers
│   ├── lib/store/wizard.ts             # zustand store (see §4.2)
│   ├── lib/validation/student-id.ts    # RUN/IPE client-side pre-check (mirror of engine rules, display only)
│   ├── messages/{es,en}.json
│   └── e2e/                            # Playwright
├── MIGRATION.md
├── CLAUDE.md
└── README.md
```

---

## 3. API contract v1

All endpoints are under the FastAPI app; the Next.js proxy forwards them 1:1.
Language: `?lang=es|en` (default `es`) or `Accept-Language`. Only
`message` fields are language-dependent; every enumerated value stays an
English internal code (`"With PIE"`, `"priority_sibling"`, `"Unmatched"`),
and the frontend translates those from `messages/*.json`.

Error format (unchanged, now everywhere): HTTP 422 with
`{"error_key": str, "message": str, "params": {}}`. `error_key` is the
English source string or a stable snake_case key; the frontend shows
`message` and may special-case `error_key`.

| Method / path | Purpose | Notes |
| --- | --- | --- |
| `GET /health` | liveness | exists |
| `GET /meta` | **new** — thresholds (`hard_unmatched_threshold`, `soft_unmatched_threshold`, `equiv_probability_change_warning_threshold`), `max_exact_equiv_permutations`, `recommendation_max_home_distance_km`, filter option lists (all `*_FILTER_OPTIONS`), `regions`, data fingerprint (hash of the 4 CSVs) | frontend reads this once; no threshold is hard-coded in `web/` |
| `GET /regions` | region names | exists; superseded by `/meta`, keep for compatibility |
| `GET /programs` | **extended** — `region`, `q`, `limit`, `offset`, plus repeatable filter params `track`, `specialty_sector`, `gender`, `school_day`, `rurality`, `pie`, `pace`, `enrollment_fee`, `monthly_fee`, `religious_orientation` | filter semantics = `program_matches_filters`; response items gain `calibration_imputed: bool` and the detail fields shown in the prototype's program-details popover |
| `GET /programs/{program_id}` | **new** — one program with all display fields | used by wish cards (so the store only holds `program_id`s) |
| `POST /simulate` | **extended** | body unchanged (`student_id`, `wishes[]` with optional `equivalence_group` + 5 flags; at most `MAX_WISHES` = 30 wishes, exposed as `/meta.max_wishes` — the prototype had no cap). Response adds: `attention_level: "low"|"moderate"|"high"`, `thresholds`, `outcomes[]` (sorted by probability, includes `Unmatched`), per-wish `lottery_number`, `priority_tier`, `lottery_population_used`, `calibration_imputed`; `equivalence_sensitivity` adds `verdict: "stable"|"stable_probability_shift"|"outcome_changes"`, `predicted_chance_min/max`, and per-variant `tied_order: [[program_id, …], …]` (structured replacement for `compact_tied_order_label`) |
| `POST /recommend` | **new** — body: `student_id`, `wishes[]` (same shape as simulate), `max_recommendations` (2–10), optional `home: {lat, lon, precision}` | server re-runs the simulation internally to obtain the current unmatched risk (no client-supplied risk); response carries `distance_reference: "home"|"list"` at the top level; items carry **raw numbers** (`chance_if_considered`, `projected_unmatched_risk`, `distance_km`, `capacity`, `applicants_per_seat`, `estimated_mtb_rank`, `score`, `risk_level: "green"|"orange"|"red"|"gray"`) plus `similarity_fallback_mode`, `hard_distance_filter_applied`, `diagnostics.failed_candidates` |
| `POST /geocode` | **new** — body: `address` | wraps `geocode_chilean_address`; response `{ok, lat, lon, precision, display_name, warning_key, error_key, params}`. Nominatim throttle (1 req/s per process) stays server-side; add a per-IP rate limit (e.g. 10/min) in front of it |

Contract rules:

- Program identity on the wire is always `program_id = f"{rbd}:{program_code}"`.
  Display labels are derived server-side (`build_program_mapping`) and
  returned as `program_label`; the frontend never reconstructs them.
- `MAX_EXACT_EQUIV_PERMUTATIONS` is enforced server-side (422
  `too_many_equivalence_orders`) *and* pre-checked client-side from
  `/meta` so the button can be disabled with the same message.
- The OpenAPI schema is committed as `web/lib/api/openapi.json` and the TS
  client is generated from it (`openapi-typescript` + a thin `fetch` wrapper).
  Regenerating is a build step, not a manual edit.

---

## 4. Frontend design

### 4.1 Wizard

```
 ○────●────○────○      1 Student   2 Build list   3 Result   4 Improve
[← Back]                                              [Continue →]
```

| Step | Route | Content | Can enter when | "Continue" enabled when |
| --- | --- | --- | --- | --- |
| 1 Student | `/[locale]/student` | RUN/IPE (with inline format/check-digit feedback), "why" popover, list-exists radio, ties toggle (+ info callout), "about this estimate" | always | RUN/IPE passes client pre-check |
| 2 Build list | `/[locale]/list` | filter panel (only if "No — help me build it"; collapsible "more filters"), program combobox with server search, wish cards (rank badge or group input, details sheet, priority collapsible, remove, reorder), imputed notice, order-count caption in ties mode | step 1 valid | ≥1 program and (ties mode) order count ≤ max |
| 3 Result | `/[locale]/result` | runs `/simulate` on entry if stale; risk metric + attention alert; outcomes list; family table; explanation popovers; detailed table (collapsible); sensitivity block in ties mode | step 2 valid | simulation succeeded |
| 4 Improve | `/[locale]/improve` | current risk; address form + geocode + clear + precision feedback; count slider; recommendation cards with risk badge; "Add selected and review" → appends, invalidates, navigates to step 2 with toast | simulation succeeded | — (terminal; back to 2) |

Stepper items are links; a step is clickable only when its "can enter"
condition holds. Deep-linking to a locked step redirects to the last allowed
step. The step guard lives in the `(wizard)/layout.tsx`.

Reordering in strict mode: drag-and-drop (`@dnd-kit/sortable`) **plus** the
existing up/down buttons for keyboard/screen-reader users. In ties mode the
group number input replaces reordering, exactly as in the prototype
(`normalize_builder_wishes` compaction happens server-side in `/simulate`;
the client only sends the raw group numbers).

### 4.2 State model (zustand, `web/lib/store/wizard.ts`)

```ts
type Wish = {
  programId: string
  equivalenceGroup: number | null   // null in strict mode
  prioritySibling: boolean
  priorityStudent: boolean
  priorityParentCivilServant: boolean
  priorityExStudent: boolean
  priorityAlreadyRegistered: boolean
}
type WizardState = {
  studentId: string                 // memory only — never persisted
  listExists: boolean | null
  useEquivalenceClasses: boolean
  filters: ProgramFilters           // region + 10 lists
  wishes: Wish[]
  simulation: SimulationResponse | null
  simulationStale: boolean
  home: GeocodeResult | null
  recommendationCount: number
}
```

Invalidation rules — a direct port of `invalidate_simulation_state` and the
callbacks in `app.py`, and they must stay a 1:1 list:

| Change | Effect |
| --- | --- |
| `studentId` changes | `simulation = null`, `simulationStale = true`; recommendations are re-fetched (server has no per-student cache to clear) |
| `useEquivalenceClasses` toggles | wishes kept; `equivalenceGroup` reset to `null` (strict) or to position (ties); simulation invalidated |
| any wish add / remove / reorder / group / flag change | simulation invalidated |
| a `programId` disappears from `/programs/{id}` (404 after data change) | wish dropped, warning toast listing the removed labels, simulation invalidated |
| recommendations appended | wishes extended with singleton groups (ties mode) or trailing ranks; simulation invalidated; navigate to step 2 with toast "N added — check priorities, then analyze again" |

Persistence: `wishes`, `listExists`, `useEquivalenceClasses`, `filters` are
persisted to `sessionStorage` (survives reload, dies with the tab).
`studentId`, `simulation`, `home` are **never** persisted — same privacy
posture as the prototype's `migrate_legacy_sensitive_state`.

### 4.3 i18n

- `next-intl` with `[locale]` segment, `es` default, `en` secondary; locale
  switcher in the header.
- Keys are semantic IDs (`step1.title`, `result.attention.high`), not
  English sentences. Phase 2 includes a one-off script that dumps
  `TRANSLATIONS["es"]` from `sae_app/i18n.py` into a draft `es.json` so no
  Spanish copy is lost; the agent then assigns IDs.
- Enumerated API values (filter options, priority tiers, `Unmatched`) are
  translated under `enums.*`. School names, communes, program display names
  are shown verbatim.
- API `message` strings are shown as-is (server already localized via `lang`).

### 4.4 Design system

shadcn/ui defaults with the prototype's restrained theme carried over from
`.streamlit/config.toml`: near-monochrome, single accent `#1F6FEB`, borders
`#E4E7EB`, radius medium, buttons pill. Light mode only for parity; dark mode
tokens are defined but not required. Components used per step are listed in
Phase 2/3 tasks (Combobox, Card, Collapsible, Sheet, Popover, Alert, Badge,
Table, Slider, Checkbox, RadioGroup, Switch, Toast, Breadcrumb/stepper).

Risk framing colours (unmatched risk badges, attention alerts) use the same
three levels and thresholds as the prototype and come from `/meta`.

### 4.5 Privacy rules carried over

- RUN/IPE lives in React state only; not in URL, not in storage, not in logs
  (the Next.js proxy must not log request bodies).
- Address is sent to `/geocode` only on explicit button click, never on
  change.
- No analytics. Next.js' own telemetry is disabled via `NEXT_TELEMETRY_DISABLED=1`
  in the `dev`/`build`/`start` scripts; do not add any analytics.

---

## 5. Backend suggestions (beyond the minimum)

Ordered by value; the first three are part of the plan, the rest optional.

1. **`sae_app/cache.py`** — a 20-line `memoize_bytes` decorator (keyed by
   `sha256(file_bytes)`) and a `TTLCache` for geocoding, replacing every
   `@st.cache_data`. `functools.lru_cache` is enough for the loaders.
2. **Request-scoped language** — `t(key, *, lang="es", **kw)`; FastAPI
   dependency reads `lang`/`Accept-Language` and passes it explicitly. No
   global mutable language.
3. **Tests** — `pytest` with golden fixtures (§6), plus `httpx`-based API
   contract tests. CI: GitHub Actions running `pytest`, `pnpm lint`,
   `pnpm test`, `pnpm e2e` (Playwright against a docker-compose stack).
4. Dockerfile per service + `docker-compose.yml` (api, web) for local and
   deployment parity.
5. Restrict CORS to the web origin (or drop CORS entirely since the proxy is
   same-origin).
6. Per-IP rate limit on `/geocode` and `/recommend` (`slowapi`).
7. Optional later: pin `requirements.txt` (`pip-compile`) once the engine is
   under test — reproducibility becomes cheap to keep.

---

## 6. Parity strategy

Parity means: same inputs → same numbers as the Streamlit prototype at commit
`0a52f56` (current `main`).

1. **Golden fixtures (Phase 0)** — a script `tests/generate_golden.py` runs
   the *current* engine for a fixed set of scenarios and writes JSON:
   - 6 strict lists (1, 3, 8, 12 wishes; with/without each priority flag;
     one with an imputed program; one with a zero-capacity program)
   - 4 equivalence lists (2 tied, two groups of 3, a 4! group, one above the
     10,000 cap; "exactly at the cap" is unreachable because order counts are
     products of factorials)
   - 3 recommendation scenarios (no home; home with `precision="address"`;
     home with city-level precision) using a fixed fake geocode result — no
     network in tests
   - 5 identifier cases (valid RUN, RUN with dots, invalid check digit,
     valid IPE, garbage)
   Each fixture stores inputs and the full engine output (choices table,
   variants, recommendation table with raw columns).
2. **Engine tests (Phase 1)** — after de-Streamlit-ing, every fixture must
   reproduce to 1e-12 on probabilities and exactly on integers/strings.
3. **API contract tests (Phase 1)** — the same fixtures through
   `/simulate` and `/recommend` via `httpx.AsyncClient`.
4. **E2E parity (Phase 6)** — Playwright drives the wizard through the same
   scenarios and asserts the rendered percentages equal the fixture values
   formatted with the same rule (`{:.1%}`).
5. Manual side-by-side check of the three-level alert boundaries in both
   apps before Phase 7 removes Streamlit.

---

## 7. Phases

Each phase lists: goal, work items (parallelisable where marked ∥), exit
gate (must be verifiable by running a command), and what the phase must NOT
touch. Phases are sequential; items inside a phase may run as parallel
agents in worktrees when they touch disjoint files.

### Phase 0 — Baseline, tests, API repair

Goal: an API that starts, and a frozen numerical baseline.

- Fix `api.py` import (`build_program_mapping`); add the three startup
  validations; make the app fail loudly at lifespan if data is invalid.
- Add `tests/` with `pytest`, `httpx`; `tests/generate_golden.py`; commit the
  generated fixtures under `tests/fixtures/golden/`.
- Write engine tests that read the fixtures (they pass trivially now — that
  is the point).
- Add `requirements-dev.txt` (`pytest`, `httpx`, `pytest-asyncio`).

Exit gate: `pytest` green; `uvicorn api:app` starts and `/health`,
`/simulate` (strict + equivalence) answer for a fixture.
Must not touch: `sae_app/*` except through the fixture generator; `web/`.

### Phase 1 — Streamlit-free engine + complete API

Goal: `python -c "import sae_app.data_loading, sae_app.geo, sae_app.recommendations, sae_app.i18n, sae_app.wish_list"` works in an environment **without** Streamlit installed; API implements §3.

- ∥ `sae_app/cache.py`; replace `@st.cache_data` in `data_loading.py`,
  `geo.py`.
- ∥ `recommendations.py`: replace the `st.session_state` cache with an
  explicit `CandidateRiskCache` object created per request (the key already
  excludes the student id; keep it that way and keep the docstring).
- ∥ `i18n.py`: explicit `lang` parameter; remove
  `initialize_language_selector` into `ui_common.py` (Streamlit-only) so the
  prototype keeps working; `wish_list.py` and `recommendations.py` must not
  call `t()` at all — return codes, let presentation translate.
- Streamlit compatibility shim: `app.py` still works, using
  `st.cache_data`-wrapped thin wrappers in `ui_common.py` if needed. The
  prototype must stay runnable until Phase 7.
- `api.py`: `/meta`, `/programs` filters + `offset`, `/programs/{id}`,
  extended `/simulate`, `/recommend`, `/geocode`, `lang` dependency,
  `params` in error bodies, structured `tied_order`.
- API contract tests for every endpoint; export
  `web/lib/api/openapi.json` via a script `scripts/export_openapi.py`.

Exit gate: `pytest` green (engine goldens still 1e-12); the import check
above passes in a venv created from `requirements-api.txt` (a new file
without `streamlit`); `python -m streamlit run app.py` still works
manually.
Must not touch: `web/`.

### Phase 2 — Frontend scaffold

Goal: an empty but navigable wizard with real data flowing.

- Install Node/pnpm; `web/` with Next.js (latest stable), TypeScript strict,
  ESLint, Prettier, Tailwind, shadcn/ui init with the theme tokens of §4.4.
- `next-intl` with `[locale]`, `es`/`en`; dump-and-convert script for the
  Spanish copy; header with locale switcher.
- Generated API client from `openapi.json`; proxy route handler; `.env`
  handling (`API_BASE_URL`).
- Zustand store per §4.2 with `sessionStorage` partial persistence;
  invalidation rules implemented and unit-tested (Vitest).
- Wizard layout: stepper, back/continue bar, step guard, four placeholder
  pages, toast provider.
- `/meta` loaded in the root layout and exposed via context.
- Playwright installed with one smoke test (loads step 1 in both locales).

Exit gate: `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm e2e` green;
navigating `/es/student` → `/es/list` works with the guard.
Must not touch: Python code.

### Phase 3 — Steps 1 and 2

Goal: the family can identify the student and build the full list.

- ∥ Step 1: RUN/IPE input with live format feedback (client mirror of
  `normalize_run`/`normalize_ipe` rules — display only, the server remains
  authoritative), popovers, radio, switch, callout.
- ∥ Step 2 filters: region select, track checkboxes, "more filters"
  collapsible with the 9 multiselects (specialty only when *Specialized* is
  ticked), matching-count caption including "kept outside filters" note.
- ∥ Step 2 list: server-searched combobox (debounced `/programs?q=`), wish
  cards (details sheet, priority collapsible with the four SAE criteria +
  separated "already enrolled", remove, dnd + arrows in strict mode, group
  input in ties mode), imputed notice, order-count caption and over-cap
  message in ties mode.
- Empty states, keyboard operability, mobile layout (single column ≤ 640 px).

Exit gate: Playwright scenarios: build a 3-wish strict list; build a tied
list and see the order count; toggle mode and confirm the list survives;
remove and reorder; both locales. `pnpm test` covers the store.

### Phase 4 — Step 3 (result)

Goal: results equal the prototype's, including the equivalence sensitivity.

- Run `/simulate` on entry when stale; loading and error states (422
  messages, over-cap).
- Risk metric, attention alert (3 levels from `/meta`), outcomes (top 4 +
  "show all"), family table, both explanation popovers, "how are the
  attention levels defined" collapsible, detailed calculation table.
- Ties mode: verdict block (3 cases with the exact copy), per-order cards
  when ≤ 12 variants, grouped-by-outcome tables otherwise, reference-order
  table, technical variants table.
- Number formatting helper mirroring `{:.1%}` and `{:,}` (locale-aware
  thousands separator for es).

Exit gate: Playwright parity for the strict and equivalence golden
fixtures (rendered percentages equal fixture values).

### Phase 5 — Step 4 (improve)

Goal: recommendations and the feedback loop into step 2.

- Current-risk metric, methodology collapsible, address form with geocode /
  clear, precision success/warning/error feedback, "address changed" hint,
  hard-filter caption logic, count slider.
- Recommendation cards with badge colours, calculation popover, similarity
  fallback notice, "no recommendation" variants, failed-candidate warning.
- "Add selected and review" → store append rule, navigation, toast; the
  success notice on step 2.

Exit gate: Playwright: from a simulated list, geocode with a mocked
`/geocode`, select two recommendations, land on step 2 with 2 new cards and
a stale simulation.

### Phase 6 — Parity, QA, hardening

- Full E2E parity run over all golden scenarios in both locales.
- Accessibility pass (axe in Playwright, focus order, labels).
- Responsive pass at 360 / 768 / 1280 px.
- Manual side-by-side session against Streamlit; record findings in
  `MIGRATION.md` §9 and fix.
- CI workflow (GitHub Actions) running Python and web checks.
- Dockerfiles + `docker-compose.yml`.

Exit gate: CI green on a PR; §9 checklist ticked.

### Phase 7 — Cutover

- Delete `app.py`, `sae_app/ui_*.py`, `sae_app/session_state.py`,
  `.streamlit/`, Streamlit from `requirements.txt` (merge
  `requirements-api.txt` back), the Streamlit shim in `ui_common.py`.
- Move remaining `TRANSLATIONS` entries that only served the UI out of
  `i18n.py` (keep error-message keys).
- Update `README.md` (workflow, installation, project structure),
  `CLAUDE.md` (remove Streamlit sections), this file (status → done).
- Restrict/remove CORS.

Exit gate: `grep -r streamlit --include=*.py .` returns nothing; `pytest`
green; CI green; README reflects the new stack.

---

## 8. Running the phases as workflows

One `Workflow` run per phase, started manually after the previous gate is
reviewed by a human. All agents use the Opus 5 model override. The script
skeleton below is the shape every phase run follows; the `TASKS` array and
gate command are the only per-phase differences.

```js
export const meta = {
  name: 'reco-migration-phase',
  description: 'Run one MIGRATION.md phase: implement work items in parallel, verify gate, review',
  phases: [
    { title: 'Implement', detail: 'one Opus agent per work item, worktree-isolated', model: 'opus' },
    { title: 'Gate', detail: 'run the phase exit-gate commands', model: 'opus' },
    { title: 'Review', detail: 'adversarial review of the merged diff against MIGRATION.md', model: 'opus' },
  ],
}

// args: { phase: 3, tasks: [{ key, prompt, files }], gate: 'pnpm test && pnpm e2e' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, summary: { type: 'string' },
  changed_files: { type: 'array', items: { type: 'string' } },
  blockers: { type: 'array', items: { type: 'string' } } },
  required: ['done', 'summary', 'changed_files', 'blockers'] }

const results = await pipeline(
  args.tasks,
  t => agent(
    `You are executing MIGRATION.md Phase ${args.phase}, work item "${t.key}".\n` +
    `Read MIGRATION.md sections 0–4 and the phase entry first; obey CLAUDE.md.\n` +
    `Scope: ${t.prompt}\nOnly touch: ${t.files.join(', ')}.\n` +
    `Do not start other work items. Return structured output.`,
    { label: `impl:${t.key}`, phase: 'Implement', model: 'opus', schema: RESULT, isolation: 'worktree' }),
)
const failed = results.filter(Boolean).filter(r => !r.done)
if (failed.length) { log(`${failed.length} work item(s) blocked`); return { failed } }

const gate = await agent(
  `Merge the worktree branches from these results into the current branch, resolve conflicts, ` +
  `then run: ${args.gate}. Report exact failing output if any.\n${JSON.stringify(results)}`,
  { label: 'gate', phase: 'Gate', model: 'opus', schema: RESULT })

const review = await agent(
  `Adversarially review the merged diff for MIGRATION.md Phase ${args.phase}: ` +
  `parity risks, privacy rules (§4.5), i18n contract, missing acceptance criteria. ` +
  `Try to prove the gate is insufficient.`,
  { label: 'review', phase: 'Review', model: 'opus', effort: 'high', schema: RESULT })

return { results, gate, review }
```

Operating rules:

- The human reviews `gate` + `review` output, merges, and only then starts
  the next phase. No phase is auto-chained.
- Work items that touch the same files are never in the same `tasks` array;
  split them across two runs instead.
- Every run's `args` is recorded in §9 so the run is reproducible
  (`resumeFromRunId` for retries after a fix).

---

## 9. Phase log

| Phase | Started | Run id | Gate result | Notes |
| --- | --- | --- | --- | --- |
| 0 | 2026-08-30 | `wf_9a779ad6-209` | green — 59 pytest, `/simulate` reproduces goldens to 1e-12 over HTTP | 2 impl agents (no worktrees, disjoint files), 1 review round with 1 must-fix (all 4 priority tiers now frozen); fixtures generated for the first time — 18 scenarios. Error body still nested under `detail` → Phase 1. |
| 1 | 2026-08-30 | `wf_5864c3a1-cc2` | green — 107 pytest, engine imports with Streamlit blocked, isolated venv from `requirements-api.txt` passes, `/simulate` & `/recommend` reproduce goldens over HTTP (delta 0.0) | 4 impl agents; review: 0 must-fix, 3 should-fix — fixed at the human gate: validation errors no longer echo the request body (RUN privacy), `MAX_WISHES` moved to `constants.py` and raised to 30 (documented in §3), openapi.json committed so the drift check is real. |
| 2 | 2026-08-30 | `wf_906ffd8c-8c1` | green — `pnpm lint/test(144)/build/e2e(9)` | Next.js 16.3.3, React 19.2, Tailwind 4, shadcn CLI 4 (`radix-nova`), next-intl 4.14, zustand; Node 26 (Current, not LTS — accepted). Deviation: `/meta` is fetched in the `(wizard)` group layout, not the root layout (keeps non-wizard pages backend-free) — keep it there. Review should-fixes fixed at the gate: Playwright now starts uvicorn too, `reuseExistingServer: !CI`, Next telemetry disabled. Open → Phase 3: `error.tsx` under `(wizard)`, `TooltipProvider`, `max_wishes` client gate, X-Forwarded-For for the geocode limiter. |
| 3 | 2026-08-30 | `wf_bebaf675-554` (run together with 4 and 5) | green — pytest 114, vitest 296, e2e 44 | Steps 1+2 complete: student step, filter panel (10 filters), server-searched combobox, wish cards with dnd + arrows, priorities, ties groups, imputed notice, order count + cap. Also closed the Phase 2 leftovers (`error.tsx`, `TooltipProvider`, h1 contract, `max_wishes` client gate, X-Forwarded-For for the geocode limiter). |
| 4 | 2026-08-30 | `wf_bebaf675-554` | green — `e2e/result.spec.ts` renders the exact golden percentages for strict_04 and equiv_01/02/03 | `formatPercent`/`fixedHalfEven` verified against CPython on 117k values. Deviation: es uses a comma decimal ("54,8%") where the prototype printed "54.8%" in both languages — accepted; parity means identical digits, locale punctuation. Open → Phase 6: ties mode with no actual ties must render the equivalence block (verdict *stable*, reference + technical tables) like the prototype; cap/paginate the technical variants table (5,040-row lists are reachable). |
| 5 | 2026-08-30 | `wf_bebaf675-554` | green — `e2e/improve.spec.ts` with intercepted `/api/geocode` | Address geocoding on click only, recommendation cards with risk badges, append → step 2. Open → Phase 6: the step-2 "N added" banner never fires (producer clears the flag; a toast stands in) — fix the step-guard race instead of the unmount workaround; render `errors.portfolioRiskFailed` when every chance is null; trim appended recommendations to `max_wishes`; bare integers (capacity, MTB rank) must not be thousands-grouped; XFF trust flag for deployments without a front proxy; delete dead `placeholder-step.tsx` / `student-step.tsx` shim / `WizardNav.pending` or wire it. |
| 6 | 2026-08-30/31 | `wf_4bb844ac-ceb` (aborted at a session limit, stage 1 of 2 complete) | **NOT gated yet** | Stage 1 landed and is committed as WIP: result fixes (ties-without-ties layout, technical-table pagination, bare-int formatting, shared Disclosure), list/improve fixes (step-guard race, added-banner, max_wishes trim, dead-code removal), backend hardening (TRUST_PROXY, env-driven CORS, constants centralized, access-log test), CI workflow + Dockerfiles + compose. **Still to do to close Phase 6:** run the full gate (`pytest` green at 118; web gate unverified), the a11y pass (`web/e2e/a11y.spec.ts` — @axe-core/playwright is installed), the responsive pass, the side-by-side parity report (`web/e2e/parity-report.md`), and an adversarial review. Re-launch as a fresh workflow (the run cache is session-local): stage 2 of the §9-recorded args, then gate + review. |
| 7 | – | – | – | |

Parity checklist (filled in Phase 6):

- [x] strict fixtures render identical digits (es uses comma decimal) — `e2e/result.spec.ts`
- [x] equivalence fixtures: verdict text, order count, per-order cards — `e2e/result.spec.ts`
- [ ] over-cap equivalence list blocked with the same message
- [ ] recommendation cards: badge colour boundaries identical
- [ ] geocode precision warnings identical for address / street / city
- [x] mode toggle keeps the list, invalidates the result — `e2e/list.spec.ts`
- [x] RUN/IPE never appears in storage or URL — `e2e/student.spec.ts`; server logs: proxy never logs bodies (unit test)

---

## 10. Risks and open points

| Risk | Mitigation |
| --- | --- |
| Program display labels change if label rules or data change → stored `programId`s stay valid but labels differ | frontend stores only `program_id`; labels always come from the API |
| pandas 3 / numpy 2 drift changes numbers between golden generation and later phases | goldens are generated once in Phase 0 and committed; Phase 1 must reproduce them before any refactor is merged |
| Nominatim throttle is per-process; multiple uvicorn workers break the 1 req/s policy | run one worker or add shared throttling (Redis) before scaling; documented in README already |
| `next-intl` semantic keys vs. prototype's English-sentence keys → translations drift | Phase 2 conversion script keeps the English sentence as a comment/`_source` field per key until Phase 7 |
| Equivalence mode with thousands of variants renders slowly in the browser | server already caps at 10,000; UI groups by outcome above 12 and paginates technical tables |
| No Node on the dev machine | Phase 2 first step; document in README |
| **Accepted deviations from the 0a52f56 baseline** (recorded so the Phase 6 side-by-side does not report them as bugs): (a) identifiers accept ASCII digits only — `sae_app/mtb_engine.py` regexes changed from `\\d` to `[0-9]` in Phase 3–5 so server and client agree (`٤٥٦-1` was accepted before, is rejected now; no golden fixture affected); (b) `MAX_WISHES = 30` cap (§3); (c) Spanish percentages use a comma decimal separator; (d) `/meta` is fetched in the `(wizard)` layout, not the root layout. | Listed in §9; the parity checklist reads "identical digits, locale punctuation". |
