"use client";

import type { ReactNode } from "react";
import { SectionBoundary } from "./SectionBoundary";
import { useSectionPackOptional } from "./SectionPackProvider";

export type SectionPackRegionProps = {
  id: string;
  /** Export / component name shown in the chip */
  component: string;
  label?: string;
  tags?: string[];
  description?: string;
  className?: string;
  /**
   * When omitted, uses SectionPack mode from context.
   * Pass false to always render children without the chip layer.
   */
  enabled?: boolean;
  children: ReactNode;
};

/**
 * Convenience wrapper: binds a region to SectionPack using context mode.
 * Prefer wrapping each marketing/layout section with explicit ids.
 */
export function SectionPackRegion({
  id,
  component,
  label,
  tags,
  description,
  className,
  enabled: enabledProp,
  children,
}: SectionPackRegionProps) {
  const pack = useSectionPackOptional();
  const enabled = enabledProp ?? pack?.enabled ?? false;

  return (
    <SectionBoundary
      id={id}
      label={label ?? id}
      component={component}
      tags={tags}
      description={description}
      enabled={enabled}
      className={className}
    >
      {children}
    </SectionBoundary>
  );
}
