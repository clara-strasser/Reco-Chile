/**
 * Number formatting, parity edition (MIGRATION.md Phase 4: "Number formatting
 * helper mirroring `{:.1%}` and `{:,}`").
 *
 * The engine is the only place a probability is computed (§0); this module is
 * the only place one is turned into text. Every helper reproduces what the
 * Streamlit prototype prints, so a golden fixture value renders identically in
 * both apps and the Playwright parity assertions can compare strings:
 *
 *   Python  f"{0.5484693677668459:.1%}"  ->  "54.8%"
 *   here    formatPercent(0.5484693677668459, "en")  ->  "54.8%"
 *                                        , "es")  ->  "54,8%"
 *
 * Three details make this exact rather than approximate:
 *
 * 1. **Scaling.** CPython's `%` presentation type multiplies the double by 100
 *    and then formats it, so the multiplication happens in binary floating
 *    point there too. `value * 100` here is therefore the same number, not a
 *    decimal-exact rescaling that could land on the other side of a boundary.
 * 2. **Rounding.** CPython rounds half to even on the *exact* binary value.
 *    Neither obvious primitive does that, and both failures are silent:
 *      · `Number.prototype.toFixed` rounds the exact value but breaks ties
 *        upwards, so it prints "6.3%" for 0.0625 where Python prints "6.2%";
 *      · `Intl.NumberFormat` with `roundingMode: "halfEven"` rounds the
 *        *shortest round-trip decimal* rather than the exact value, so it sees
 *        a tie wherever the shortest repr ends in 5 and rounds to even — it
 *        prints "4.4%" for 0.0435, where the exact double is 4.34999…996 and
 *        Python prints "4.3%". That disagreed with CPython on 292 of 22,008
 *        sampled probabilities (1.3%), which is exactly the kind of drift the
 *        golden fixtures exist to prevent.
 *    {@link fixedHalfEven} therefore rounds the exact expansion by hand.
 * 3. **Separators.** Locale handling is deliberately *not* delegated to CLDR.
 *    `Intl` renders `es` percentages as "54,8 %" (with a non-breaking space)
 *    and suppresses grouping below 10,000, neither of which is what the
 *    prototype prints. The punctuation comes from the table below instead.
 */

/** Punctuation per UI language. `es` is the default locale (§4.3). */
type Separators = { decimal: string; group: string };

const SPANISH: Separators = { decimal: ",", group: "." };
const ENGLISH: Separators = { decimal: ".", group: "," };

/** Shown instead of a number when the value is missing or not finite. */
export const MISSING_NUMBER = "—";

function separators(locale: string): Separators {
  return locale.toLowerCase().startsWith("es") ? SPANISH : ENGLISH;
}

/**
 * Extra digits of the exact expansion to look at before deciding a tie.
 *
 * `toFixed` is specified on the exact mathematical value of the double, so
 * `abs.toFixed(digits + GUARD_DIGITS)` shows the true expansion rather than the
 * shortest round-trip repr. 25 guard digits are far more than needed to tell a
 * real tie from a near one: for any magnitude this app prints (probabilities,
 * percentages, kilometres, counts) the spacing between neighbouring doubles is
 * larger than 1e-16, so a value that is not exactly on the boundary differs
 * from it well inside the guard, and one that is on the boundary has a
 * terminating expansion that fits.
 */
const GUARD_DIGITS = 25;

/**
 * `value` rounded to `digits` decimals, half to even on the exact binary value
 * — CPython's rule for `{:.Nf}`, `{:.N%}` and `round(x, N)`.
 *
 * Returns a plain unlocalized string ("4.3", "1234", "0.0"); grouping and the
 * decimal separator are applied by the callers. Negative zero never survives:
 * the engine never means one, and Python would print "-0.0".
 */
export function fixedHalfEven(value: number, digits: number): string {
  const negative = value < 0;
  const abs = Math.abs(value);

  // Beyond 2^53 every double is an integer and `toFixed` switches to
  // exponential notation past 1e21; no rounding decision is left to make.
  // The sign still has to be put back — nothing here can be a negative zero,
  // since `abs` is at least 1e15.
  if (abs >= 1e15) {
    const body = abs.toFixed(digits);
    return negative ? `-${body}` : body;
  }

  const expansion = abs.toFixed(digits + GUARD_DIGITS);
  const point = expansion.indexOf(".");
  const kept = (
    expansion.slice(0, point) + expansion.slice(point + 1, point + 1 + digits)
  ).split("");
  const rest = expansion.slice(point + 1 + digits);

  const first = rest.charCodeAt(0) - 48;
  let roundUp: boolean;
  if (first !== 5) {
    roundUp = first > 5;
  } else if (/[1-9]/.test(rest.slice(1))) {
    roundUp = true; // Above the boundary, so not a tie after all.
  } else {
    // A real tie: keep the last digit even.
    roundUp = (kept[kept.length - 1].charCodeAt(0) - 48) % 2 === 1;
  }

  if (roundUp) {
    let index = kept.length - 1;
    for (;;) {
      if (kept[index] !== "9") {
        kept[index] = String.fromCharCode(kept[index].charCodeAt(0) + 1);
        break;
      }
      kept[index] = "0";
      index -= 1;
      if (index < 0) {
        kept.unshift("1"); // 9.99 -> 10.0
        break;
      }
    }
  }

  const rounded = kept.join("");
  const integerLength = rounded.length - digits;
  const integerPart = rounded.slice(0, integerLength) || "0";
  const fraction = rounded.slice(integerLength);
  const body = digits > 0 ? `${integerPart}.${fraction}` : integerPart;
  return negative && /[1-9]/.test(rounded) ? `-${body}` : body;
}

/** Thousands separators over a run of digits — Python's `,` format option. */
function group(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * A probability (0–1) as a one-decimal percentage — the exact output of
 * Python's `f"{value:.1%}"`, with a comma decimal separator in Spanish.
 *
 * `null`, `undefined` and non-finite values render as {@link MISSING_NUMBER}
 * rather than "NaN%": the API sends `null` for a variant with no predicted
 * outcome chance, and a dash is what that means to a family.
 */
export function formatPercent(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING_NUMBER;
  }
  const text = fixedHalfEven(value * 100, 1);
  return `${text.replace(".", separators(locale).decimal)}%`;
}

/**
 * An integer with thousands separators — Python's `f"{value:,}"`, using the
 * locale's group separator ("1,234" in English, "1.234" in Spanish).
 *
 * Used for counts the prototype prints with `{n:,}`: compatible strict orders,
 * the permutation cap, seats, applicants.
 */
export function formatInt(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING_NUMBER;
  }
  const digits = fixedHalfEven(value, 0);
  const negative = digits.startsWith("-");
  const body = group(
    negative ? digits.slice(1) : digits,
    separators(locale).group,
  );
  return negative ? `-${body}` : body;
}

/**
 * An integer with **no** thousands separator — Python's plain `f"{value}"`.
 *
 * The prototype prints two different kinds of integer and only groups one of
 * them. Counts it narrates in a sentence go through `{n:,}` ("10,000 compatible
 * strict orders"); identifiers and quantities inside a table do not — the MTB
 * lottery rank, the seat count and the historical applicant count are printed
 * by `st.dataframe` as bare numbers, and `ui_common.format_display_table`
 * renders Capacity and Estimated MTB rank with `f"{int(round(float(x)))}"`.
 * A grouped "1.234" for a lottery rank would read as a different number in
 * Spanish, where "." is the group separator, so the distinction matters.
 *
 * Rounding is the same half-to-even rule as everywhere else, so a float that
 * arrives here (a rank the engine averaged, say) becomes the integer CPython's
 * `round()` would produce.
 */
export function formatBareInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING_NUMBER;
  }
  return fixedHalfEven(value, 0);
}
