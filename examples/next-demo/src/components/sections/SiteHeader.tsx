import { header } from "@/content/home";

export function SiteHeader() {
  return (
    <header className="nl-header">
      <div className="nl-header__inner nl-container">
        <a className="nl-logo" href="/">
          {header.logo}
          <span>.</span>
        </a>
        <nav className="nl-nav" aria-label="Primary">
          {header.nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="nl-btn nl-btn--primary" href={header.ctaHref}>
          {header.cta}
        </a>
      </div>
    </header>
  );
}
