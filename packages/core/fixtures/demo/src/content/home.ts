export const siteMeta = {
  name: "Northline",
  tagline: "Clarity for growing teams",
  demoHref: "/demo",
  email: "hello@northline.example",
} as const;

export const promoBar = {
  label: "Introducing Northline Reports",
  href: "/product/reports",
} as const;

export const nav = {
  links: [
    { label: "Product", href: "/product" },
    { label: "Pricing", href: "/pricing" },
  ],
} as const;

export const hero = {
  title: "Clarity for growing teams",
  body: "Northline helps operators see cash, runway, and decisions in one place.",
  primaryCta: "Book a demo",
  primaryHref: "/demo",
  secondaryCta: "See product",
  secondaryHref: "/product",
} as const;

export const features = {
  items: [
    { title: "Live runway", body: "Always-on cash forecast." },
    { title: "Simple close", body: "Close books without chaos." },
    { title: "Team clarity", body: "Shared numbers, less meetings." },
  ],
} as const;

export const cta = {
  title: "Ready when you are",
  body: "Book a 30-minute walkthrough with the Northline team.",
  buttonLabel: "Book a demo",
  href: "/demo",
} as const;

export const footer = {
  copyright: "© Northline",
  columns: [{ title: "Product", links: [{ label: "Overview", href: "/product" }] }],
} as const;
