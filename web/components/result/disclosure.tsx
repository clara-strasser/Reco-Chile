"use client";

/**
 * The prototype's `st.expander` as a shadcn `Collapsible`.
 *
 * Every "Show all…", "See the detailed calculation…", "Technical details…"
 * block on this step is one of these, so the trigger affordance (chevron,
 * focus ring, hit area) is defined once. Closed by default, exactly like
 * `expanded=False` in `ui_simulation.py`.
 */

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function Disclosure({
  label,
  children,
  className,
  contentClassName,
  ...props
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
} & Omit<React.ComponentProps<typeof Collapsible>, "children">) {
  return (
    <Collapsible
      className={cn("rounded-lg border border-border", className)}
      {...props}
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {label}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "flex flex-col gap-3 border-t border-border px-3 py-3 text-sm",
          contentClassName,
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
