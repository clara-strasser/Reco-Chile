"use client";

/**
 * Wire value → family-facing string, through the `enums.*` catalogue.
 *
 * Every enumerated value the API returns is an English internal code
 * ("With PIE", "Specialized", "Free") — MIGRATION.md §3 — and the frontend owns
 * its display string (§4.3). A value that has no entry is rendered verbatim
 * rather than as a raw message id: catalogues drift, but a family should still
 * read *something* about their school. A blank or `nan` value becomes
 * "No information", exactly like `ui_wish_builder._family_display_value`.
 */

import { useCallback } from "react";
import { useTranslations } from "next-intl";

/** `(group, value)` where `group` is a sub-key of `enums` ("pie", "payment"). */
export type EnumLabel = (
  group: string,
  value: string | null | undefined,
) => string;

export function useEnumLabel(): EnumLabel {
  const enums = useTranslations("enums");
  const filters = useTranslations("filters");

  return useCallback(
    (group, value) => {
      const raw = (value ?? "").trim();
      if (raw === "" || raw.toLowerCase() === "nan") {
        return filters("details.noInformation");
      }
      const key = `${group}.${raw}`;
      return enums.has(key) ? enums(key) : raw;
    },
    [enums, filters],
  );
}
