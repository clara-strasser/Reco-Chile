"use client";

/**
 * The two figures step 3 opens with (MIGRATION.md §9b, item 5).
 *
 * Product feedback round 1 replaced the prototype's risk metric + three-level
 * attention alert with a positively framed headline: *how likely am I to get a
 * place at all*, and *which school is that most likely to be*. Both are read
 * straight from the `/simulate` response — the frontend never computes a
 * probability (§0), and `1 − unmatched_risk` is a presentation of the same
 * number, not a second model.
 *
 * `attention_level` is still on the wire and is deliberately ignored here: the
 * levels, their thresholds and their alerts are gone from the UI, so nothing in
 * `web/` reads or explains them any more.
 *
 * **The second card reads `outcomes[0]`, not `predicted_outcome`.** They are
 * not the same question. `wish_list.predicted_outcome_from_choices` answers
 * "Unmatched" as soon as the unmatched risk reaches `HARD_UNMATCHED_THRESHOLD`
 * (2.7%) — it is the prototype's *alert* trigger, a deliberate warning device,
 * not an argmax. A list with a 4% unmatched risk and a 42% top school would
 * then have this card say "most likely you receive none of your programs" over
 * a card saying "96% chance of being assigned", with that school listed first
 * at 42% right below. `outcomes[]` is sorted by probability and includes
 * `Unmatched` (§3), so its first entry *is* the most likely outcome, and the
 * card is true by construction. `predicted_outcome` still drives the
 * equivalence verdicts, where it is prototype parity.
 *
 * The card therefore has two shapes, because the top outcome has two: a program
 * (then the card names the school and which of *your* preferences it is —
 * `wish_rank`, looked up in the response's own wishes) or `Unmatched` (then it
 * says plainly that the most likely outcome is receiving none of the listed
 * programs). The unmatched shape is deliberately styled like the other one — no
 * red, no alert icon: it is a statement of the most likely outcome, and the
 * alarm framing is exactly what the feedback asked to remove.
 *
 * The school is named with its commune and region (§9b item 4): several hundred
 * Chilean schools share a name, and the label alone can point at the wrong one.
 */

import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import type { SimulationResponse } from "@/lib/api/types";
import { formatInt, formatPercent } from "@/lib/format";

import { useResultLabels } from "./labels";

/** The engine's outcome code for "none of the listed programs" (§3). */
const UNMATCHED = "Unmatched";

export function ResultHeadline({
  simulation,
}: {
  simulation: SimulationResponse;
}) {
  const t = useTranslations("result");
  const locale = useLocale();
  const labels = useResultLabels(simulation);

  // The most likely outcome, by probability — `Unmatched` included. The engine
  // always appends it, so the list is never empty; the guard below is for a
  // response shape that has drifted, not for a case the API can produce.
  const top = simulation.outcomes.at(0);
  const unmatched = top === undefined || top.label === UNMATCHED;

  // The wish the top school sits at — by id, which is the join key on the wire;
  // the label is only a fallback for a response that carries no id.
  const predictedWish = unmatched
    ? undefined
    : simulation.wishes.find((wish) =>
        top.program_id
          ? wish.program_id === top.program_id
          : wish.program_label === top.label,
      );
  // `Unmatched`'s own probability *is* `unmatched_risk`; the fallback only
  // matters for the impossible empty-outcomes case.
  const predictedChance = top?.probability ?? simulation.unmatched_risk;
  const location = unmatched ? "" : labels.location(top.program_id);

  return (
    <section className="flex flex-col gap-3" data-testid="result-headline">
      <h2 className="text-lg font-semibold tracking-tight">{t("heading")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="justify-between">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              {t("headline.chanceTitle")}
            </span>
            <span
              className="text-4xl font-semibold tabular-nums sm:text-5xl"
              data-testid="assignment-chance"
            >
              {formatPercent(1 - simulation.unmatched_risk, locale)}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("headline.chanceNote")}
            </span>
          </CardContent>
          <CardContent className="text-sm text-muted-foreground">
            {t("headline.riskNote")}{" "}
            <span className="tabular-nums" data-testid="unmatched-risk">
              {formatPercent(simulation.unmatched_risk, locale)}
            </span>
          </CardContent>
        </Card>

        <Card className="justify-between">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              {t(
                unmatched
                  ? "headline.unmatchedTitle"
                  : "headline.mostLikelyTitle",
              )}
            </span>
            {unmatched ? (
              <span
                className="text-lg font-semibold text-balance sm:text-xl"
                data-testid="predicted-unmatched"
              >
                {t("headline.unmatchedBody")}
              </span>
            ) : (
              <>
                <span
                  className="text-xl font-semibold text-balance sm:text-2xl"
                  data-testid="predicted-school"
                >
                  {labels.outcome(top.label)}
                </span>
                {location === "" ? null : (
                  <span
                    className="text-sm text-muted-foreground"
                    data-testid="predicted-location"
                  >
                    {location}
                  </span>
                )}
                {predictedWish ? (
                  <span
                    className="text-sm text-muted-foreground"
                    data-testid="predicted-rank"
                  >
                    {t("headline.preferenceRank", {
                      rank: formatInt(predictedWish.wish_rank, locale),
                    })}
                  </span>
                ) : null}
              </>
            )}
          </CardContent>
          <CardContent
            className="text-sm text-muted-foreground"
            data-testid="predicted-chance"
          >
            {t("headline.outcomeChance", {
              chance: formatPercent(predictedChance, locale),
            })}
          </CardContent>
        </Card>
      </div>

      {/* "…an estimate, not an official SAE result" — kept verbatim. */}
      <p className="text-sm text-muted-foreground" data-testid="estimate-note">
        {t("explain.percentagesBody")}
      </p>
    </section>
  );
}
