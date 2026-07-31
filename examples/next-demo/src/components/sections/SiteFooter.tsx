import { footer } from "@/content/home";

/** Closing brand blurb, links, and legal line. */
export function SiteFooter() {
  return (
    <footer className="nl-footer">
      <div className="nl-container nl-footer__grid">
        <div>
          <h2 className="nl-footer__brand">{footer.brand}</h2>
          <p className="nl-footer__blurb">{footer.blurb}</p>
        </div>
        <nav className="nl-footer__nav" aria-label="Footer">
          {footer.links.map((link) => (
            <a key={link.href} className="nl-link-quiet" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="nl-container nl-footer__legal">{footer.legal}</div>
    </footer>
  );
}
