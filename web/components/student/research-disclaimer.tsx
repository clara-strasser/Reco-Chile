"use client";

import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * The research-tool disclaimer, at the top of step 1 (MIGRATION.md §9b item 2:
 * "show the research-tool disclaimer prominently at the top ... then the
 * RUN/IPE input").
 *
 * The prototype states it once, in the page caption (`app.tagline`), where it
 * competes with the tool's own description. Here it is the first thing above
 * the only field that asks for something personal, and it is addressed to the
 * family directly (§9b item 1) rather than talking about "the student".
 */
export function ResearchDisclaimer() {
  const t = useTranslations("student");

  return (
    <Alert data-testid="student-disclaimer">
      <InfoIcon aria-hidden="true" />
      <AlertDescription>{t("disclaimer")}</AlertDescription>
    </Alert>
  );
}
