import type { Metadata } from "next";
import { SectionPackProvider } from "@ctrlc/react";
import "@ctrlc/react/styles/section-pack.css";
import "@/styles/demo.css";

export const metadata: Metadata = {
  title: "Northline | Product analytics that stay out of your way",
  description:
    "Northline demo marketing page for CtrlC SectionPack. Fictional analytics startup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultEnabled = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <body>
        <SectionPackProvider
          apiBase="/api/dev/section-pack"
          catalogHref="/dev/packs"
          defaultEnabled={defaultEnabled}
        >
          {children}
        </SectionPackProvider>
      </body>
    </html>
  );
}
