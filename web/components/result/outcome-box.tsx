"use client";

/**
 * The whole of step 3's result, in one box (product feedback round 2).
 *
 * Round 1 had already replaced the prototype's risk metric and attention
 * alerts with a positively framed headline; round 2 goes further and removes
 * everything else the page carried — the overall-chance figure, the outcome
 * list, the per-preference table, the equivalence sensitivity block and the
 * detailed calculation. What is left is the single question a family actually
 * arrives with: *where am I most likely to end up, and how likely is that?*
 *
 * The numbers are read straight from `/simulate`; nothing here computes a
 * probability (§0).
 *
 * **It reads `outcomes[0]`, not `predicted_outcome`.** They answer different
 * questions. `wish_list.predicted_outcome_from_choices` returns "Unmatched" as
 * soon as the unmatched risk reaches `HARD_UNMATCHED_THRESHOLD` (2.7%) — it is
 * the prototype's *alert* trigger, not an argmax — so a list with a 4%
 * unmatched risk and a 42% top school would report "none of your programs".
 * `outcomes[]` is sorted by probability and includes `Unmatched` (§3), so its
 * first entry really is the most likely outcome and the box is true by
 * construction. `predicted_outcome` is left to the equivalence verdicts, where
 * it is prototype parity.
 *
 * The box therefore has two shapes, because the top outcome has two: a program
 * (named with its commune and region, §9b.4 — several hundred Chilean schools
 * share a name) or `Unmatched`.
 *
 * The unmatched shape is *only* the sentence. It deliberately carries no
 * percentage: the number that belongs to it is the probability of the outcome,
 * not of getting in, and "you receive none of the programs on your list" over
 * "Estimated chance: 100.0%" read as a 100% chance of a place. It keeps the
 * same neutral styling and only drops the check mark — it states the most
 * likely outcome, and the alarm framing is what feedback round 1 removed.
 *
 * `attention_level` and `unmatched_risk` are still on the wire and are
 * deliberately unread — no part of `web/` explains those any more.
 */

import { CircleCheckIcon, InfoIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { SimulationResponse } from "@/lib/api/types";
import { formatInt, formatPercent } from "@/lib/format";

import { useResultLabels } from "./labels";

/** The engine's outcome code for "none of the listed programs" (§3). */
const UNMATCHED = "Unmatched";

export function OutcomeBox({ simulation }: { simulation: SimulationResponse }) {
  const t = useTranslations("result");
  const locale = useLocale();
  const labels = useResultLabels(simulation);

  // The engine always appends `Unmatched`, so the list is never empty; the
  // guard is for a response shape that has drifted, not one the API produces.
  const top = simulation.outcomes.at(0);
  const unmatched = top === undefined || top.label === UNMATCHED;

  // The wish the top school sits at — matched by id, the wire's join key; the
  // label is only a fallback for a response that carries no id.
  const predictedWish = unmatched
    ? undefined
    : simulation.wishes.find((wish) =>
        top.program_id
          ? wish.program_id === top.program_id
          : wish.program_label === top.label,
      );
  // Only the program shape prints this; the fallback matters for the
  // impossible empty-outcomes case, which takes the unmatched branch anyway.
  const chance = top?.probability ?? simulation.unmatched_risk;
  const location = unmatched ? "" : labels.location(top.program_id);

  return (
    <Card data-testid="result-outcome">
      <CardContent className="flex flex-col gap-5 py-2">
        {unmatched ? (
          <p
            className="text-lg font-medium text-balance"
            data-testid="predicted-unmatched"
          >
            {t("headline.unmatchedBody")}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-medium">
              <CircleCheckIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              {t("outcome.title")}
            </p>

            <div className="flex flex-col gap-1">
              <p
                className="text-xl font-semibold text-balance sm:text-2xl"
                data-testid="predicted-school"
              >
                {labels.outcome(top.label)}
              </p>
              {location === "" ? null : (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="predicted-location"
                >
                  {location}
                </p>
              )}
              {predictedWish ? (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="predicted-rank"
                >
                  {t("headline.preferenceRank", {
                    rank: formatInt(predictedWish.wish_rank, locale),
                  })}
                </p>
              ) : null}
            </div>

            <p className="text-base font-medium" data-testid="predicted-chance">
              {t("outcome.chance", {
                chance: formatPercent(chance, locale),
              })}
            </p>
          </>
        )}
      </CardContent>

      <CardFooter className="gap-2 text-sm text-muted-foreground">
        <InfoIcon aria-hidden="true" className="size-4 shrink-0" />
        <span data-testid="estimate-note">{t("outcome.disclaimer")}</span>
      </CardFooter>
    </Card>
  );
}
