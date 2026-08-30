"use client";

/**
 * Step 2 — build and order the preference list (MIGRATION.md §4.1, §4.2;
 * prototype: `app.py` lines 242-470 plus `ui_wish_builder`).
 *
 * Section order is the prototype's, top to bottom:
 *
 *   heading + one caption that depends on the mode
 *   "N recommended programs were added…"      (returning from step 4)
 *   filter panel                              (only "No — help me build it")
 *   program search + Add
 *   the wish list itself
 *   "some programs use imputed calibration"   (+ "What does this mean?")
 *   the compatible-order count                (ties mode only)
 *
 * The step owns three things the individual components deliberately do not:
 * the `/meta.max_wishes` limit it hands to the store (so every gate — this
 * page's and the wizard nav's — uses one number), the one `usePrograms` lookup
 * over the whole list (which answers both "is any of them imputed?" and "did
 * any of them vanish?"), and the reaction to the latter — `dropMissingPrograms`
 * plus one warning toast, exactly like `app.py`.
 */

import * as React from "react";
import { CircleCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { FilterPanel } from "@/components/list/filters/filter-panel";
import { ImputedNotice } from "@/components/list/imputed-notice";
import { OrderCount } from "@/components/list/order-count";
import { ProgramSearch } from "@/components/list/program-search";
import { WishList } from "@/components/list/wish-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMeta } from "@/lib/meta";
import { usePrograms } from "@/lib/programs";
import { useWizardStore } from "@/lib/store/wizard";

/** How many removed programs `app.py` names before it prints an ellipsis. */
const MAX_NAMED_REMOVALS = 5;

export function ListStep() {
  const t = useTranslations();
  const meta = useMeta();

  const listExists = useWizardStore((state) => state.listExists);
  const ties = useWizardStore((state) => state.useEquivalenceClasses);
  const wishes = useWizardStore((state) => state.wishes);
  const addWish = useWizardStore((state) => state.addWish);
  const setMaxWishes = useWizardStore((state) => state.setMaxWishes);
  const dropMissingPrograms = useWizardStore(
    (state) => state.dropMissingPrograms,
  );
  const recommendationsAdded = useWizardStore(
    (state) => state.recommendationsAddedNotice,
  );
  const clearRecommendationsNotice = useWizardStore(
    (state) => state.clearRecommendationsNotice,
  );

  // One source for the length gate: the store applies it to `isWishListValid`,
  // which is what both the Continue button and the stepper read.
  React.useEffect(() => {
    setMaxWishes(meta.max_wishes);
  }, [meta.max_wishes, setMaxWishes]);

  // --- what the whole list looks like in the data --------------------------
  const wishIds = React.useMemo(
    () => wishes.map((wish) => wish.programId),
    [wishes],
  );
  const { programs, missing } = usePrograms(wishIds);

  // `app.py`: any selected program with `calibration_imputed` triggers the
  // notice, whatever its position.
  const anyImputed = wishes.some(
    (wish) => programs.get(wish.programId)?.calibration_imputed === true,
  );

  // --- programs that disappeared from the data (§4.2) ----------------------
  // `missing` is a fresh array on every render, so the effect keys on its
  // content; dropping the wishes shortens the list and ends the cycle.
  const missingKey = missing.join(",");
  React.useEffect(() => {
    if (missingKey === "") return;
    const dropped = dropMissingPrograms(missingKey.split(","));
    if (dropped.length === 0) return;

    const named = dropped.slice(0, MAX_NAMED_REMOVALS);
    if (dropped.length > named.length) named.push("…");
    // A 404 leaves no label to print, so the id is what the family sees — the
    // same identity the API refused.
    toast.warning(t("list.notices.removed", { programs: named.join(", ") }));
  }, [missingKey, dropMissingPrograms, t]);

  // --- "N recommendations were added" (§4.2, arriving from step 4) ---------
  // Streamlit's `st.session_state.pop(...)`: shown once, then cleared, so the
  // message cannot reappear on a later visit. It is mirrored into local state —
  // adjusted during render, never in an effect — because clearing the store
  // must not take the notice off the screen again. The value can arrive *after*
  // this component mounts: step 4 commits its append in an unmount cleanup,
  // which React runs after the new route has rendered, so reading the store
  // once at mount would miss it.
  const [addedNotice, setAddedNotice] = React.useState(recommendationsAdded);
  const [seenNotice, setSeenNotice] = React.useState(recommendationsAdded);
  if (recommendationsAdded !== seenNotice) {
    setSeenNotice(recommendationsAdded);
    if (recommendationsAdded > 0) setAddedNotice(recommendationsAdded);
  }
  React.useEffect(() => {
    if (addedNotice > 0) clearRecommendationsNotice();
  }, [addedNotice, clearRecommendationsNotice]);

  // --- adding a program ----------------------------------------------------
  const atMaxWishes = wishes.length >= meta.max_wishes;

  const handleAdd = React.useCallback(
    (programId: string) => {
      // `MAX_WISHES` is enforced by `/simulate`; refusing here keeps the family
      // from building a list the engine would reject.
      if (useWizardStore.getState().wishes.length >= meta.max_wishes) {
        toast.warning(t("list.notices.maxWishes", { max: meta.max_wishes }));
        return;
      }
      addWish(programId);
    },
    [addWish, meta.max_wishes, t],
  );

  const needsBuilder = listExists === false;

  return (
    <section className="flex flex-col gap-6" data-testid="step-list">
      <header className="flex flex-col gap-2">
        {/* Same frame as `components/wizard/step-page.tsx` — the step title is
            the page's single `<h1>` — but written out here because the lead
            sentence of this step is the one that depends on the mode, which
            `StepPage`'s static `STEP_LEAD_KEY` cannot express. */}
        <h1 className="text-xl font-semibold tracking-tight text-balance">
          {t("list.title")}
        </h1>
        {/* The prototype prints a different caption per branch: the filter
            intro when it is helping to build the list, the preference-order
            reminder when the family already has one. */}
        <p
          className="text-sm text-pretty text-muted-foreground"
          data-testid="list-caption"
        >
          {needsBuilder
            ? t("list.filters.intro")
            : t("list.order.preferenceHint")}
        </p>
      </header>

      {addedNotice > 0 ? (
        <Alert data-testid="recommendations-added">
          <CircleCheckIcon aria-hidden="true" />
          <AlertDescription>
            {t("list.notices.recommendationsAdded", { n: addedNotice })}
          </AlertDescription>
        </Alert>
      ) : null}

      {needsBuilder ? <FilterPanel /> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("list.search.title")}</h2>
        <ProgramSearch
          onAdd={handleAdd}
          excludeIds={wishIds}
          disabled={atMaxWishes}
        />
        {atMaxWishes ? (
          <p className="text-sm text-destructive" data-testid="max-wishes">
            {t("list.notices.maxWishes", { max: meta.max_wishes })}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("list.current.title")}</h2>
        {wishes.length > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="wish-count">
            {t("list.current.count", { n: wishes.length })}
          </p>
        ) : null}
        {wishes.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {ties ? t("wishes.group.hint") : t("list.order.reorderHint")}
          </p>
        ) : null}

        <WishList />

        {wishes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("list.notices.addAtLeastOne")}
          </p>
        ) : null}
      </section>

      <ImputedNotice imputed={anyImputed} />
      <OrderCount />
    </section>
  );
}
