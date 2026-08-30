import { hasLocale } from "next-intl";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Locale index (`/es`, `/en`) — the wizard has no landing screen of its own, so
 * this sends the family straight to step 1 (`/[locale]/(wizard)/student`).
 *
 * Together with `proxy.ts` this is what makes a bare `/` resolve: the proxy
 * redirects `/` to `/es` (default locale, `localePrefix: "always"`), and this
 * page then redirects `/es` to `/es/student`.
 */

export default async function LocaleIndex({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;

  redirect({
    href: "/student",
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  });
}
