"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * The prototype's sidebar expander `st.expander(t("About this estimate"))`
 * (`app.py` lines 137-142), closed by default.
 *
 * The wizard has no sidebar, so the caveat moves to the first step — the point
 * at which the family starts entering data is where "these are estimates, not
 * admission guarantees" has to be read.
 *
 * The copy comes from the `app.aboutEstimate.*` ids rather than a `student.*`
 * copy of them: the same two sentences are already the result step's lead
 * (`STEP_LEAD_KEY.result`), and one sentence with two ids is exactly the drift
 * `lib/i18n-messages.test.ts` exists to prevent.
 */
export function AboutEstimate() {
  const t = useTranslations("app.aboutEstimate");

  return (
    <Collapsible className="rounded-xl ring-1 ring-foreground/10">
      <CollapsibleTrigger
        className="group flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        data-testid="about-estimate-trigger"
      >
        {t("title")}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className="flex flex-col gap-2 px-4 pb-3 text-sm text-muted-foreground"
        data-testid="about-estimate-content"
      >
        <p>{t("body")}</p>
        <p>{t("mtbMode")}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
