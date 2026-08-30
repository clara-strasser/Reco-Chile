"use client";

/**
 * "Estimated final chance by preference" — the short table a family reads
 * first (`ui_simulation.format_family_choices_table`), followed by the
 * "Chance if considered vs. final chance" popover and the detailed
 * calculation, exactly as `render_simulation_result` lays them out in strict
 * mode.
 */

import { InfoIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SimulationResponse } from "@/lib/api/types";
import { formatInt, formatPercent } from "@/lib/format";

import { DetailTable } from "./detail-table";
import { Disclosure } from "./disclosure";
import { useResultLabels } from "./labels";

export function FamilyChanceTable({
  simulation,
}: {
  simulation: SimulationResponse;
}) {
  const t = useTranslations("result");
  const locale = useLocale();
  const labels = useResultLabels(simulation);

  return (
    <section className="flex flex-col gap-3" data-testid="family-table-section">
      <h3 className="text-lg font-semibold tracking-tight">
        {t("table.title")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("detail.note")}</p>

      <div className="w-full overflow-x-auto">
        <Table data-testid="family-table">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">
                {t("table.preference")}
              </TableHead>
              <TableHead>{t("table.establishment")}</TableHead>
              <TableHead className="text-right">
                {t("table.estimatedFinalChance")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {simulation.wishes.map((wish) => (
              <TableRow key={`${wish.wish_rank}-${wish.program_id}`}>
                <TableCell className="text-right tabular-nums">
                  {formatInt(wish.wish_rank, locale)}
                </TableCell>
                <TableCell>{labels.outcome(wish.program_label)}</TableCell>
                <TableCell
                  className="text-right tabular-nums"
                  data-testid="final-chance"
                  data-program-id={wish.program_id}
                >
                  {formatPercent(wish.choice_assignment_probability, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <Popover>
          <PopoverTrigger className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <InfoIcon aria-hidden="true" className="size-4" />
            {t("explain.chanceTitle")}
          </PopoverTrigger>
          <PopoverContent align="start">
            <PopoverDescription>{t("explain.chanceShort")}</PopoverDescription>
          </PopoverContent>
        </Popover>
      </div>

      <Disclosure label={t("detail.trigger")}>
        <DetailTable simulation={simulation} />
        <p className="text-muted-foreground">{t("detail.technicalNote")}</p>
      </Disclosure>
    </section>
  );
}
