"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import { useMeta } from "@/lib/meta";

import { StepPage } from "./step-page";

/**
 * Step 2 — build and order the preference list (MIGRATION.md §4.1).
 *
 * Phase 2 renders only the number of regions `/meta` reports. That is the
 * deliberate scaffold check: it proves the whole data path — FastAPI →
 * `fetchMeta()` on the server → `MetaProvider` → `useMeta()` in the client tree
 * — before the filter panel, the program combobox and the wish cards land in
 * Phase 3, when this count becomes the region select.
 */
export function ListStep() {
  const t = useTranslations();
  const meta = useMeta();

  return (
    <StepPage slug="list">
      <Card>
        <CardContent>
          <dl className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">
              {t("list.filters.region.label")}
            </dt>
            <dd className="font-medium tabular-nums" data-testid="meta-regions">
              {meta.regions.length}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </StepPage>
  );
}
