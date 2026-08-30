"use client";

import { CircleQuestionMarkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The prototype's `st.popover(t("Why do we ask for this?"))` next to the
 * RUN/IPE field (`app.py` §1).
 *
 * It carries the same two paragraphs as the prototype, in the same order: what
 * the identifier is used for, then the privacy caveat as a caption. Nothing is
 * reworded — the copy is looked up from `student.why.*`, whose Spanish values
 * come verbatim from `messages/_source.es.json`.
 */
export function WhyWeAsk() {
  const t = useTranslations("student.why");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" data-testid="student-why-trigger">
          <CircleQuestionMarkIcon aria-hidden="true" data-icon="inline-start" />
          {t("title")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80"
        data-testid="student-why-content"
      >
        <PopoverHeader>
          <PopoverTitle>{t("title")}</PopoverTitle>
        </PopoverHeader>
        <p>{t("body")}</p>
        {/* `st.caption` in the prototype: the same paragraph, one level quieter. */}
        <PopoverDescription className="text-xs">
          {t("privacy")}
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
