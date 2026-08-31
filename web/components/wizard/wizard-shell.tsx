"use client";

import * as React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { Meta } from "@/lib/api/types";
import { MetaProvider } from "@/lib/meta";
import { hydrateWizardStore, useWizardStore } from "@/lib/store/wizard";

import { StepGuard } from "./step-guard";
import { Stepper } from "./stepper";
import { useWizardGating } from "./use-wizard-gating";
import { WizardNav } from "./wizard-nav";

/**
 * The wizard's client component tree: stepper, step guard and the Back/Continue
 * bar around whichever step page the router rendered — except on the
 * completion page (`/finish`, §9b item 6), which the router puts in the same
 * group but which is drawn bare, guarded on a fresh simulation alone.
 *
 * `app/[locale]/(wizard)/layout.tsx` stays a server component so it can await
 * `fetchMeta()`; this is the boundary where everything becomes interactive.
 *
 * The centred column, its max width and the page's `<main>` belong to
 * `app/[locale]/layout.tsx` — the prototype's `layout="centered"` — so this
 * component only stacks the wizard's own three parts inside it. The page's
 * single `<h1>` is the step title, rendered by `step-page.tsx`.
 *
 * `TooltipProvider` is mounted once here rather than per step: Radix keeps the
 * "skip the open delay while another tooltip was just open" timer in that
 * provider, so one provider around the whole wizard is what makes hovering
 * along a row of info icons behave as a single group. Steps render bare
 * `Tooltip`s and never their own provider.
 */
export function WizardShell({
  meta,
  children,
}: {
  meta: Meta;
  children: React.ReactNode;
}) {
  return (
    <MetaProvider meta={meta}>
      <TooltipProvider>
        <WizardShellInner>{children}</WizardShellInner>
      </TooltipProvider>
    </MetaProvider>
  );
}

/** Inside the provider, so the gating hook can read `/meta`. */
function WizardShellInner({ children }: { children: React.ReactNode }) {
  // The store persists `wishes` / `listExists` / `useEquivalenceClasses` /
  // `filters` to sessionStorage with `skipHydration`, so that the first client
  // render matches the server HTML; this is the one place that rehydrates it.
  React.useEffect(() => {
    void hydrateWizardStore();
  }, []);

  const { kind, slug, allowed, fallbackHref, canEnter, canContinue } =
    useWizardGating();

  // `WizardNav.pending` is owned by whichever step has a request in flight; the
  // shell only forwards it, and a step raises it through `setStepBusy` — see
  // the contract on `stepBusy` in the store. No step sets it today (the result
  // step's `/simulate` announces itself with its own skeleton, and since §9b
  // item 6 that step has no Continue), so the spinner never appears until one
  // does.
  const stepBusy = useWizardStore((state) => state.stepBusy);

  // The completion page shares the group's layout — `/meta`, the store, the
  // toaster — but it is not a step (§9b item 6): no rail, no Back/Continue, and
  // its own gate (a fresh simulation). Everything above this line is a hook, so
  // the early return changes no hook order.
  if (kind === "finish") {
    return (
      <div className="flex min-h-full flex-col">
        <StepGuard slug={null} allowed={allowed} fallbackHref={fallbackHref}>
          {children}
        </StepGuard>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Stepper current={slug} canEnter={canEnter} />
      <div className="flex-1 pt-8">
        <StepGuard slug={slug} allowed={allowed} fallbackHref={fallbackHref}>
          {children}
        </StepGuard>
      </div>
      <WizardNav slug={slug} canContinue={canContinue} pending={stepBusy} />
    </div>
  );
}
