"use client";

/**
 * A program named the way MIGRATION.md §9b item 4 requires: its label, and
 * under it the commune and the region.
 *
 * Step 3 lists programs in four places — the headline's most likely school, the
 * outcome podium, the family table and the detailed calculation — and several
 * hundred Chilean schools share a name, so the label alone can point a family
 * at a school in another region. `components/list/program-location.ts` builds
 * the line; this component is only its placement, shared so the four sites
 * cannot drift apart.
 *
 * An empty `location` renders nothing: it means the lookup has not answered yet
 * (`useResultLabels().location` returns `""` until then), and a placeholder
 * that appears a moment later moves the table under the reader's eyes.
 */

export function ProgramLine({
  name,
  location,
  nameClassName,
}: {
  name: string;
  location: string;
  /** Typography of the name itself; the location line is always secondary. */
  nameClassName?: string;
}) {
  return (
    <span className="flex flex-col">
      <span className={nameClassName}>{name}</span>
      {location === "" ? null : (
        <span
          className="text-xs text-muted-foreground"
          data-testid="program-location"
        >
          {location}
        </span>
      )}
    </span>
  );
}
