import { SectionBoundary } from "@ctrlc/react";
import {
  Cta,
  Features,
  Hero,
  HowItWorks,
  PromoBar,
  SiteFooter,
  SiteHeader,
} from "@/components/sections";

/**
 * Northline homepage. Section ids must match section-pack-config:
 * promo, header, hero, features, how-it-works, cta, footer.
 */
export default function HomePage() {
  return (
    <>
      <a className="nl-skip-link" href="#main-content">
        Skip to content
      </a>
      <main id="main-content" tabIndex={-1}>
        <SectionBoundary
          id="promo"
          label="Promo bar"
          component="PromoBar"
          tags={["chrome", "announcement", "cta"]}
          description="Top announcement strip linking to product news."
        >
          <PromoBar />
        </SectionBoundary>

        <SectionBoundary
          id="header"
          label="Site header"
          component="SiteHeader"
          tags={["chrome", "nav"]}
          description="Sticky marketing header with nav links and primary CTA."
        >
          <SiteHeader />
        </SectionBoundary>

        <SectionBoundary
          id="hero"
          label="Hero"
          component="Hero"
          tags={["hero", "cta", "stats"]}
          description="Primary hero with headline, CTAs, stats, and insight panel."
        >
          <Hero />
        </SectionBoundary>

        <SectionBoundary
          id="features"
          label="Features"
          component="Features"
          tags={["features", "cards"]}
          description="Three-up feature cards explaining product pillars."
        >
          <Features />
        </SectionBoundary>

        <SectionBoundary
          id="how-it-works"
          label="How it works"
          component="HowItWorks"
          tags={["how-it-works", "steps", "process"]}
          description="Three-step path from stack connect to shared briefing."
        >
          <HowItWorks />
        </SectionBoundary>

        <SectionBoundary
          id="cta"
          label="CTA band"
          component="Cta"
          tags={["cta", "conversion"]}
          description="Conversion band with trial CTA and trust note."
        >
          <Cta />
        </SectionBoundary>

        <SectionBoundary
          id="footer"
          label="Site footer"
          component="SiteFooter"
          tags={["chrome", "footer"]}
          description="Closing brand blurb, links, and legal line."
        >
          <SiteFooter />
        </SectionBoundary>
      </main>
    </>
  );
}
