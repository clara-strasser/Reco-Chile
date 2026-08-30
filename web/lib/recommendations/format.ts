/**
 * The two number shapes step 4 prints that `@/lib/format` does not cover.
 *
 * `formatPercent` and `formatInt` are the shared parity helpers — same rounding
 * as CPython, same separators as the prototype — and are re-exported here so a
 * recommendation component has one import, not two. Nothing is reimplemented:
 * MIGRATION.md §6.4 compares *rendered strings* against the golden fixtures, so
 * a second percentage formatter would be a second chance to diverge. The two
 * additions round through the very same `fixedHalfEven` core and only differ in
 * how many decimals they ask for and how they punctuate:
 *
 *   Python                            here
 *   `f"{d:.1f} km"`                   formatDistanceKm(4.25, "en") -> "4.2"
 *   `str(round(ratio, 2))`            formatRatio(1.2, "es")       -> "1,2"
 *
 * Unlike the shared helpers, these two return `null` rather than a dash when
 * the value is missing: both lines are optional in `ui_recommendations.py`
 * (`if distance != "" and not pd.isna(distance)`), so the caller drops the whole
 * sentence instead of printing a sentence about a dash.
 */

import { fixedHalfEven } from "@/lib/format";

export { formatInt, formatPercent, MISSING_NUMBER } from "@/lib/format";

/** `es` is the default UI language (§4.3); everything else prints like English. */
function decimalSeparator(locale: string): string {
  return locale.toLowerCase().startsWith("es") ? "," : ".";
}

export function isFiniteNumber(
  value: number | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** `{:.1f}` — the straight-line distance caption, or `null` to omit it. */
export function formatDistanceKm(
  value: number | null | undefined,
  locale: string,
): string | null {
  if (!isFiniteNumber(value)) return null;
  return fixedHalfEven(value, 1).replace(".", decimalSeparator(locale));
}

/**
 * `str(round(ratio, 2))` — applicants per seat.
 *
 * `recommendations.py:769` stores `round(competition_ratio, 2)` and
 * `ui_recommendations.py:424` interpolates that float straight into an
 * f-string, so the prototype prints Python's `str(float)`: trailing zeros are
 * dropped, but a whole number keeps one decimal ("3.0", never "3").
 */
export function formatRatio(
  value: number | null | undefined,
  locale: string,
): string | null {
  if (!isFiniteNumber(value)) return null;
  const rounded = fixedHalfEven(value, 2)
    .replace(/(\.\d*?)0+$/, "$1") // 1.20 -> 1.2, 3.00 -> 3.
    .replace(/\.$/, ".0"); // 3. -> 3.0, the way Python prints a whole float
  return rounded.replace(".", decimalSeparator(locale));
}
