import type { Metadata } from "next";
import { SectionPackProvider } from "@ctrlc/react";
import "@ctrlc/react/styles/section-pack.css";
import "@/styles/app.css";

export const metadata: Metadata = {
  title: "CtrlC clone",
  description: "Empty clone host with SectionPack. Compose React sections on the page.",
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
          defaultEnabled={defaultEnabled}
        >
          {children}
        </SectionPackProvider>
      </body>
    </html>
  );
}
