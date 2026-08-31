"use client";

/**
 * The estimated outcomes of step 3, below the headline.
 *
 * It used to be the whole summary — the risk metric, the three-level attention
 * alert and the "How are the attention levels defined?" disclosure of
 * `ui_simulation.render_single_summary`. Product feedback round 1 (MIGRATION.md
 * §9b, item 5) removed the attention system from the UI altogether: no levels,
 * no alerts, no thresholds explained anywhere. The response still carries
 * `attention_level` and `thresholds`; nothing here reads them.
 *
 * What survives is what a family actually asked for — the ranked outcomes
 * (top four, all of them behind a disclosure) and the popover that explains how
 * to read the percentages. The two headline figures moved up into
 * `result-headline.tsx`.
 *
 * Every number is rendered from the response through `formatPercent`, the
 * mirror of the prototype's `{:.1%}`; nothing is recomputed here. Every named
 * school carries its commune and region (§9b item 4); `Unmatched` has no
 * program id and so no location line.
 */

import { InfoIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Disclosure } from "@/components/ui/disclosure";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SimulationResponse } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";

import { useResultLabels } from "./labels";
import { ProgramLine } from "./program-line";

/** How many outcomes the podium shows before the "show all" disclosure. */
const PODIUM_SIZE = 4;

export function ResultSummary({
  simulation,
}: {
  simulation: SimulationResponse;
}) {
  const t = useTranslations("result");
  const locale = useLocale();
  const labels = useResultLabels(simulation);

  const outcomes = simulation.outcomes;
  const podium = outcomes.slice(0, PODIUM_SIZE);

  return (
    <section className="flex flex-col gap-4" data-testid="result-summary">
      <h2 className="text-lg font-semibold tracking-tight">
        {t("outcomes.title")}
      </h2>

      <ol className="flex flex-col gap-1 text-sm" data-testid="outcome-podium">
        {podium.map((outcome, index) => (
          <li
            key={`${outcome.program_id ?? outcome.label}-${index}`}
            className="flex items-baseline justify-between gap-3"
            data-testid="outcome-item"
          >
            <span className="flex items-baseline gap-1">
              <span className="text-muted-foreground">{index + 1}.</span>
              <ProgramLine
                name={labels.outcome(outcome.label)}
                location={labels.location(outcome.program_id)}
                nameClassName="font-medium"
              />
            </span>
            <span className="tabular-nums">
              {formatPercent(outcome.probability, locale)}
            </span>
          </li>
        ))}
      </ol>

      {outcomes.length > PODIUM_SIZE ? (
        <Disclosure label={t("outcomes.showAll")}>
          <ol className="flex flex-col gap-1" data-testid="all-outcomes">
            {outcomes.map((outcome, index) => (
              <li
                key={`${outcome.program_id ?? outcome.label}-${index}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="flex items-baseline gap-1">
                  <span className="text-muted-foreground">{index + 1}.</span>
                  <ProgramLine
                    name={labels.outcome(outcome.label)}
                    location={labels.location(outcome.program_id)}
                  />
                </span>
                <span className="tabular-nums">
                  {formatPercent(outcome.probability, locale)}
                </span>
              </li>
            ))}
          </ol>
        </Disclosure>
      ) : null}

      <div>
        <Popover>
          <PopoverTrigger className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <InfoIcon aria-hidden="true" className="size-4" />
            {t("explain.percentagesTitle")}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={t("explain.percentagesTitle")}
          >
            <PopoverDescription>
              {t("explain.outcomeOrdering")}
            </PopoverDescription>
            <PopoverDescription>
              {t("explain.finalChanceNote")}
            </PopoverDescription>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}
