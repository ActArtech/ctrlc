import { hero } from "@/content/home";

/** Primary landing hero with dual CTAs, stats, and insight panel. */
export function Hero() {
  return (
    <section className="nl-hero" id="hero">
      <div className="nl-container nl-hero__grid">
        <div className="nl-hero__copy">
          <p className="nl-tag">{hero.eyebrow}</p>
          <h1 className="nl-hero__title">{hero.title}</h1>
          <p className="nl-hero__subtitle">{hero.subtitle}</p>
          <div className="nl-hero__actions">
            <a className="nl-btn nl-btn--primary" href={hero.primaryCta.href}>
              {hero.primaryCta.label}
            </a>
            <a className="nl-btn nl-btn--ghost" href={hero.secondaryCta.href}>
              {hero.secondaryCta.label}
            </a>
          </div>
          <ul className="nl-hero__stats">
            {hero.stats.map((s) => (
              <li key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="nl-hero__panel" aria-label="Sample insight briefing">
          <div className="nl-hero__panel-card">
            <div className="nl-hero__panel-head">
              <span className="nl-badge">Live briefing</span>
              <span className="nl-hero__panel-meta">Last 7 days</span>
            </div>
            <p className="nl-hero__panel-metric">+18.4%</p>
            <p className="nl-hero__panel-label">Activation to paid</p>
            <div className="nl-hero__bars" aria-hidden="true">
              <span style={{ height: "42%" }} />
              <span style={{ height: "58%" }} />
              <span style={{ height: "51%" }} />
              <span style={{ height: "72%" }} />
              <span style={{ height: "66%" }} />
              <span style={{ height: "84%" }} />
            </div>
            <p className="nl-hero__panel-foot">
              Drivers: onboarding checklist + pricing page experiment
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
