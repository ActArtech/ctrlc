"use client";

import { type ReactNode, useCallback, useState } from "react";
import { cn } from "./cn";
import { PackOverlay } from "./PackOverlay";
import { useSectionPackOptional } from "./SectionPackProvider";

export type SectionBoundaryProps = {
  id: string;
  label?: string;
  component: string;
  /** When omitted, uses provider `enabled` */
  enabled?: boolean;
  children: ReactNode;
  className?: string;
  tags?: string[];
  description?: string;
};

/**
 * Wraps a section with the SectionPack hover layer (top-left chip).
 * When enabled, hovering reveals copy tools for the full section pack.
 * Multi-select: checkbox on chip or Alt+click; selected gets accent ring.
 */
export function SectionBoundary({
  id,
  label,
  component,
  enabled: enabledProp,
  children,
  className,
  tags,
  description,
}: SectionBoundaryProps) {
  const pack = useSectionPackOptional();
  const enabled = enabledProp ?? pack?.enabled ?? false;
  const [hover, setHover] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  const selected = pack?.isSelected(id) ?? false;
  const focused = pack?.focusedPackId === id;

  const onEnter = useCallback(() => setHover(true), []);
  const onLeave = useCallback(() => {
    if (!panelOpen && !pinned) setHover(false);
  }, [panelOpen, pinned]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "spack-boundary",
        (hover || panelOpen || pinned) && "is-hot",
        (panelOpen || pinned) && "is-panel-open",
        pinned && "is-pinned",
        selected && "is-selected",
        focused && "is-focused",
        className,
      )}
      data-section-pack={id}
      data-spack-selected={selected ? "true" : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {pack ? (
        <PackOverlay
          meta={{
            id,
            label: label ?? id,
            component,
            tags: tags ?? [],
            description,
          }}
          active={hover || panelOpen || pinned || selected}
          pinned={pinned}
          selected={selected}
          onPinnedChange={setPinned}
          onToggleSelect={() => pack.toggleSelected(id)}
          onOpenChange={(open) => {
            setPanelOpen(open);
            if (!open) {
              setHover(false);
              setPinned(false);
            }
          }}
        />
      ) : null}
      <div className="spack-boundary__content">{children}</div>
    </div>
  );
}
