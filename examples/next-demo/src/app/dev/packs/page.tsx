import type { Metadata } from "next";
import { SectionPackCatalog } from "@ctrlc/next";

export const metadata: Metadata = {
  title: "Section packs (dev) | Northline",
  robots: { index: false, follow: false },
};

function packsEnabled() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.SECTION_PACK_ENABLED === "true"
  );
}

/**
 * Dev catalog of SectionPack entries for the Northline homepage.
 */
export default function DevPacksPage() {
  if (!packsEnabled()) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "3rem 1.5rem",
          maxWidth: 720,
          margin: "0 auto",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Section packs
        </h1>
        <p style={{ color: "#64748b", lineHeight: 1.5 }}>
          Disabled outside development. Set{" "}
          <code
            style={{
              background: "#f1f5f9",
              padding: "0.1em 0.35em",
              borderRadius: 4,
            }}
          >
            SECTION_PACK_ENABLED=true
          </code>{" "}
          to enable.
        </p>
      </main>
    );
  }

  return (
    <SectionPackCatalog
      apiBase="/api/dev/section-pack"
      homeHref="/"
      title="Northline section packs"
    />
  );
}
