"use client";

/**
 * The per-wish calculation table — `ui_simulation.format_choices_table`.
 *
 * Same eight columns in the same order, the two probability columns formatted
 * with the prototype's `{:.1%}` and the priority tier translated from
 * `enums.priorityTier` (the wire value stays the English code, §3). Used twice:
 * under "See the detailed calculation for each preference" in strict mode, and
 * under "Detailed calculation for the reference order" in ties mode.
 *
 * The table scrolls inside its own container so eight columns never make the
 * page scroll sideways on a phone. The program column carries the commune and
 * the region under the label (§9b item 4).
 *
 * Grouping follows the prototype column by column: the wish rank is a narrated
 * count (`{:,}`), while the MTB lottery rank, the seat count and the historical
 * applicant count are printed bare by `st.dataframe`, so they go through
 * {@link formatBareInt}. In Spanish a grouped "1.234" would read as 1.234, a
 * different number entirely.
 */

import { useLocale, useTranslations } from "next-intl";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SimulationResponse } from "@/lib/api/types";
import { formatBareInt, formatInt, formatPercent } from "@/lib/format";

import { useResultLabels } from "./labels";
import { ProgramLine } from "./program-line";

export function DetailTable({
  simulation,
  wishes = simulation.wishes,
  testId = "detail-table",
}: {
  simulation: SimulationResponse;
  /** Defaults to the reference order carried by the response. */
  wishes?: SimulationResponse["wishes"];
  testId?: string;
}) {
  const t = useTranslations("result.table");
  const locale = useLocale();
  const labels = useResultLabels(simulation);

  return (
    <div className="w-full overflow-x-auto">
      <Table data-testid={testId}>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">{t("wishRank")}</TableHead>
            <TableHead>{t("program")}</TableHead>
            <TableHead className="text-right">{t("lotteryRank")}</TableHead>
            <TableHead>{t("priorityTier")}</TableHead>
            <TableHead className="text-right">{t("seats")}</TableHead>
            <TableHead className="text-right">{t("applicants")}</TableHead>
            <TableHead className="text-right">
              {t("chanceIfConsidered")}
            </TableHead>
            <TableHead className="text-right">{t("finalChance")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wishes.map((wish) => (
            <TableRow key={`${wish.wish_rank}-${wish.program_id}`}>
              <TableCell className="text-right tabular-nums">
                {formatInt(wish.wish_rank, locale)}
              </TableCell>
              <TableCell>
                <ProgramLine
                  name={labels.outcome(wish.program_label)}
                  location={labels.location(wish.program_id)}
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBareInt(wish.lottery_number)}
              </TableCell>
              <TableCell>{labels.tier(wish.priority_tier)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBareInt(wish.capacity)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBareInt(wish.true_applicants_last_year)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(wish.availability_probability, locale)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(wish.choice_assignment_probability, locale)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
