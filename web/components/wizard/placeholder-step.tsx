"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";

import { StepPage } from "./step-page";
import type { StepSlug } from "./steps";

type PlaceholderSlug = Extract<StepSlug, "result" | "improve">;

/** One further line of prototype copy per step, under the lead sentence. */
const NOTE_KEY = {
  result: "result.explain.chanceShort",
  improve: "improve.methodNote",
} as const satisfies Record<PlaceholderSlug, string>;

/**
 * Steps 3 and 4 in the Phase 2 scaffold.
 *
 * They carry their real title, their real lead sentence and one further line of
 * prototype copy, but no controls: the result view lands in Phase 4 and the
 * recommendations in Phase 5. What is being verified here is that the routes
 * exist and that the step guard only lets a family reach them once the earlier
 * gates hold.
 */
export function PlaceholderStep({ slug }: { slug: PlaceholderSlug }) {
  const t = useTranslations();

  return (
    <StepPage slug={slug}>
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t(NOTE_KEY[slug])}</p>
        </CardContent>
      </Card>
    </StepPage>
  );
}
