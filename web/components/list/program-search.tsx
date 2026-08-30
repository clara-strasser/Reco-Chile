"use client";

/**
 * The program combobox of step 2 (`ui_wish_builder`'s "Search and add
 * programs": a searchable select plus an Add button).
 *
 * The prototype could hold every program label in one Streamlit `selectbox`;
 * a browser cannot, so the search is done server-side — `GET /programs?q=`,
 * debounced, over school name, commune and program name (§3). That has a second
 * benefit: the combobox and the filter panel's matching count are answered by
 * the *same* endpoint, so they can never disagree about what exists.
 *
 * Which filters apply follows `app.py`: only the guided-builder branch
 * ("No — help me build it") narrows the add list. When the family said their
 * list already exists, the panel is not rendered and the search stays global.
 * Pass `filters` explicitly to override that.
 *
 * Selecting is separate from adding, exactly as in the prototype: the family
 * picks a program, reads it back on the trigger, then presses Add. Programs
 * already on the list stay visible but are disabled — seeing that a school is
 * already chosen answers the question faster than its absence would.
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ProgramSummary } from "@/lib/api/types";
import { useProgramSearch } from "@/lib/programs";
import { useWizardStore } from "@/lib/store/wizard";
import type { ProgramFilters } from "@/lib/store/types";

export type ProgramSearchProps = {
  /** Called with the chosen `program_id` when Add is pressed. */
  onAdd: (programId: string) => void;
  /** Programs already on the list: shown, but not addable again. */
  excludeIds?: readonly string[];
  /** Overrides the filter source; `null` searches every program. */
  filters?: ProgramFilters | null;
  /** Set while the list is at `/meta.max_wishes`, say. */
  disabled?: boolean;
  className?: string;
};

const NO_EXCLUSIONS: readonly string[] = [];

export function ProgramSearch({
  onAdd,
  excludeIds = NO_EXCLUSIONS,
  filters,
  disabled = false,
  className,
}: ProgramSearchProps) {
  const t = useTranslations("filters");

  const storeFilters = useWizardStore((state) => state.filters);
  const listExists = useWizardStore((state) => state.listExists);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProgramSummary | null>(null);

  const effectiveFilters =
    filters !== undefined
      ? filters
      : listExists === false
        ? storeFilters
        : null;

  const { items, truncated, loading, error } = useProgramSearch({
    q: query,
    filters: effectiveFilters,
    enabled: open,
  });

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const selectedExcluded =
    selected !== null && excluded.has(selected.program_id);
  const showEmpty = !loading && error === null && items.length === 0;

  function handleAdd() {
    if (selected === null || excluded.has(selected.program_id)) return;
    onAdd(selected.program_id);
    setSelected(null);
    setQuery("");
  }

  return (
    <div
      className={className ?? "flex flex-col gap-1.5"}
      data-testid="program-search"
    >
      <Label id="program-search-label" htmlFor="program-search-trigger">
        {t("search.label")}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="program-search-trigger"
              data-testid="program-search-trigger"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-labelledby="program-search-label program-search-value"
              disabled={disabled}
              className="h-auto min-w-0 flex-1 justify-between py-2 text-left font-normal whitespace-normal"
            >
              <span id="program-search-value" className="min-w-0 flex-1">
                {selected?.program_label ?? t("search.placeholder")}
              </span>
              <ChevronsUpDownIcon
                aria-hidden
                className="size-4 shrink-0 opacity-50"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-(--radix-popover-trigger-width) min-w-72 p-0"
          >
            {/* Server-side search: cmdk must not re-filter what came back. */}
            <Command shouldFilter={false}>
              <CommandInput
                data-testid="program-search-input"
                value={query}
                onValueChange={setQuery}
                placeholder={t("search.inputPlaceholder")}
              />
              <CommandList>
                {loading ? (
                  <p
                    role="status"
                    data-testid="program-search-loading"
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    {t("search.loading")}
                  </p>
                ) : null}
                {error !== null ? (
                  <p
                    role="alert"
                    data-testid="program-search-error"
                    className="px-3 py-6 text-center text-sm text-destructive"
                  >
                    {t("search.error")} {error.message}
                  </p>
                ) : null}
                {showEmpty ? (
                  <p
                    role="status"
                    data-testid="program-search-empty"
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    {t("search.empty")}
                  </p>
                ) : null}
                {items.length > 0 ? (
                  <CommandGroup>
                    {items.map((program) => {
                      const isExcluded = excluded.has(program.program_id);
                      return (
                        <CommandItem
                          key={program.program_id}
                          value={program.program_id}
                          disabled={isExcluded}
                          data-testid="program-search-option"
                          data-program-id={program.program_id}
                          data-excluded={isExcluded ? "true" : "false"}
                          data-checked={
                            selected?.program_id === program.program_id
                          }
                          onSelect={() => {
                            setSelected(program);
                            setOpen(false);
                          }}
                          className="items-start"
                        >
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm font-medium text-wrap">
                              {program.program_label}
                            </span>
                            <span className="text-xs text-wrap text-muted-foreground">
                              {program.school_commune} · {program.region}
                              {isExcluded ? ` · ${t("search.added")}` : ""}
                            </span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ) : null}
                {truncated ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {t("search.truncated", { n: items.length })}
                  </p>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          data-testid="program-search-add"
          disabled={disabled || selected === null || selectedExcluded}
          onClick={handleAdd}
        >
          <PlusIcon aria-hidden className="size-4" />
          {t("search.add")}
        </Button>
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        {t("search.help")}
      </p>
    </div>
  );
}
