import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { WelcomeScreen } from "@/components/wizard/welcome-screen";
import { routing } from "@/i18n/routing";

/**
 * Locale index (`/es`, `/en`) — the wizard's welcome page (MIGRATION.md §9b
 * item 2).
 *
 * It used to redirect straight to step 1. Since the product feedback round it
 * is the front door: the positive framing headline plus the "do you already
 * have a list?" choice that step 1 asked with a radio before. The choice writes
 * `listExists`, which is what `canEnterStep(1)` requires, so this page is also
 * where the step guard sends anyone deep-linking into the wizard without it.
 *
 * Deliberately outside the `(wizard)` route group: no stepper, no
 * Back/Continue bar, and no `/meta` fetch — the front door stays up even when
 * the FastAPI service is down.
 *
 * Together with `proxy.ts` this is what makes a bare `/` resolve: the proxy
 * redirects `/` to `/es` (default locale, `localePrefix: "always"`).
 */

export default async function LocaleIndex({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(
    hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  );

  return <WelcomeScreen />;
}
