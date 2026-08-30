"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import {
  STEP_LABEL_KEY,
  STEP_SLUGS,
  stepNumber,
  stepPath,
  type StepSlug,
} from "./steps";

type StepperProps = {
  current: StepSlug;
  /** The store's `canEnterStep`, per slug; a locked step is not a link. */
  canEnter: (slug: StepSlug) => boolean;
};

/**
 * The `○────●────○────○` rail of MIGRATION.md §4.1.
 *
 * Every step is a link, but only while its "can enter" condition holds; a locked
 * step renders as inert text carrying `steps.locked` as its tooltip, so keyboard
 * and screen-reader users meet the same gate — and the same explanation — as the
 * guard enforces on the route.
 *
 * Mobile first: four numbered markers stay on one row down to 360 px, with the
 * labels beneath them shrinking rather than wrapping the rail.
 */
export function Stepper({ current, canEnter }: StepperProps) {
  const t = useTranslations("steps");
  const currentIndex = STEP_SLUGS.indexOf(current);

  return (
    <nav
      aria-label={t("progress", {
        current: currentIndex + 1,
        total: STEP_SLUGS.length,
      })}
    >
      <ol className="flex items-start">
        {STEP_SLUGS.map((slug, index) => {
          const isCurrent = slug === current;
          const isDone = index < currentIndex;
          const isLink = canEnter(slug) && !isCurrent;
          const label = t(STEP_LABEL_KEY[slug]);

          const marker = (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                isCurrent &&
                  "border-primary bg-primary text-primary-foreground",
                !isCurrent &&
                  isDone &&
                  "border-primary/40 bg-primary/10 text-primary",
                !isCurrent && !isDone && "border-border bg-background",
                !isCurrent && !isDone && !isLink && "text-muted-foreground",
              )}
            >
              {isDone ? (
                <CheckIcon className="size-3.5" aria-hidden="true" />
              ) : (
                stepNumber(slug)
              )}
            </span>
          );

          const text = (
            <span
              className={cn(
                "text-center text-[0.7rem] leading-tight sm:text-xs",
                isCurrent && "font-medium text-foreground",
                !isCurrent && isLink && "text-muted-foreground",
                !isCurrent && !isLink && "text-muted-foreground/60",
              )}
            >
              {label}
            </span>
          );

          return (
            <li
              key={slug}
              className="flex flex-1 flex-col items-center gap-1.5"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex w-full items-center gap-1">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px flex-1",
                    index === 0 ? "bg-transparent" : "bg-border",
                  )}
                />
                {isLink ? (
                  <Link
                    href={stepPath(slug)}
                    aria-label={`${stepNumber(slug)}. ${label}`}
                    className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {marker}
                  </Link>
                ) : (
                  <span title={isCurrent ? undefined : t("locked")}>
                    {marker}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px flex-1",
                    index === STEP_SLUGS.length - 1
                      ? "bg-transparent"
                      : "bg-border",
                  )}
                />
              </div>
              {isLink ? (
                <Link
                  href={stepPath(slug)}
                  tabIndex={-1}
                  className="rounded-sm px-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {text}
                </Link>
              ) : (
                text
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
