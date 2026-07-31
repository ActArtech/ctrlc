export const siteMeta = {
  name: "Northline",
  tagline: "Product analytics that stay out of your way",
  demoHref: "#demo",
  email: "hello@northline.example",
  primaryCta: "Start free trial",
  secondaryCta: "Book a walkthrough",
};

export const promoBar = {
  label: "New: cohort retention boards with AI summaries",
  href: "#features",
};

export const header = {
  logo: siteMeta.name,
  nav: [
    { label: "Product", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#cta" },
  ],
  cta: siteMeta.primaryCta,
  ctaHref: "#cta",
};

export const hero = {
  eyebrow: "Analytics for growth teams",
  title: "Ship decisions, not dashboards",
  subtitle:
    "Northline connects product events, revenue, and experiments so your team can answer \"what moved the metric?\" in minutes.",
  primaryCta: { label: siteMeta.primaryCta, href: "#cta" },
  secondaryCta: { label: siteMeta.secondaryCta, href: "#demo" },
  stats: [
    { value: "12m+", label: "events / day handled" },
    { value: "4.9★", label: "avg. customer rating" },
    { value: "18 min", label: "median time to first insight" },
  ],
};

export const features = {
  eyebrow: "Why Northline",
  title: "Everything between raw events and a clear next step",
  items: [
    {
      title: "Unified event graph",
      body: "Normalize product, billing, and support signals without a six-month data project.",
    },
    {
      title: "Answer-first views",
      body: "Retention, activation, and revenue boards that explain the change, not just chart it.",
    },
    {
      title: "Shareable briefings",
      body: "One-click summaries your PM, founder, and finance partner can actually read.",
    },
  ],
};

export const howItWorks = {
  eyebrow: "How it works",
  title: "From first event to a shared briefing",
  steps: [
    {
      title: "Connect your stack",
      body: "Point Northline at product events, billing, and support tools without a warehouse rebuild.",
    },
    {
      title: "Ask what moved",
      body: "Open answer-first boards for retention, activation, and revenue with the change story built in.",
    },
    {
      title: "Share the brief",
      body: "Send a one-page summary your PM, founder, and finance partner can act on the same day.",
    },
  ],
};

export const cta = {
  id: "cta",
  title: "See Northline on your funnel this week",
  body: "Connect a sandbox project in under ten minutes. No credit card for the trial.",
  primaryCta: { label: "Start free trial", href: "#demo" },
  note: "SOC2-ready infrastructure. EU and US data regions.",
};

export const footer = {
  brand: siteMeta.name,
  blurb: siteMeta.tagline,
  links: [
    { label: "Product", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Contact", href: `mailto:${siteMeta.email}` },
  ],
  legal: `© ${new Date().getFullYear()} Northline Labs. Demo brand for CtrlC.`,
};
