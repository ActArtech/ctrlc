"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ctrlc:section-pack-mode";

function readInitial(defaultEnabled: boolean): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("packs") === "1" || params.get("packs") === "true") {
    return true;
  }
  if (params.get("packs") === "0") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* ignore */
  }
  return defaultEnabled;
}

/**
 * Global SectionPack inspector mode.
 * - Default from `defaultEnabled` (pass true in development hosts)
 * - Toggle: Ctrl/Cmd + Shift + P
 * - Force: ?packs=1 or ?packs=0
 * - Persists to localStorage
 */
export function useSectionPackMode(defaultEnabled = true) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEnabled(readInitial(defaultEnabled));
    setReady(true);
  }, [defaultEnabled]);

  const setMode = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("packs", "1");
    else url.searchParams.delete("packs");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const toggle = useCallback(() => {
    setMode(!enabled);
  }, [enabled, setMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "p"
      ) {
        e.preventDefault();
        setMode(!enabled);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, setMode]);

  return { enabled, ready, setMode, toggle };
}
