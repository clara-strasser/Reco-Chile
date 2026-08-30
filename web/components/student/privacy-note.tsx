"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The standing privacy statement of step 1 (MIGRATION.md §4.5).
 *
 * The prototype's equivalent sentence is hidden inside the "Why do we ask for
 * this?" popover; in the wizard it is also shown unprompted, because the two
 * facts it states are what the family is being asked to trust before typing an
 * identifier: the numbers are computed by the Python engine on the server, and
 * the only outbound request this application ever makes — Nominatim geocoding —
 * happens on an explicit click in step 4 and nowhere else.
 *
 * The wording is deliberately not the prototype's: `student.why.privacy` says
 * "in this application", which was true of a single-process Streamlit app; the
 * split frontend/backend deployment of §2 makes "on the server" the accurate
 * statement, and the RUN/IPE's memory-only lifetime (§4.2) is worth saying out
 * loud now that a browser is involved at all.
 */
export function PrivacyNote() {
  const t = useTranslations("student");

  return (
    <p
      className="flex items-start gap-2 text-xs text-muted-foreground"
      data-testid="student-privacy-note"
    >
      <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{t("privacyNote")}</span>
    </p>
  );
}
