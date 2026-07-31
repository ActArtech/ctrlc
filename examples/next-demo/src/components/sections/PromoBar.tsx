import { promoBar } from "@/content/home";

export function PromoBar() {
  return (
    <div className="nl-promo">
      <a className="nl-promo__inner nl-container" href={promoBar.href}>
        <span className="nl-promo__dot" aria-hidden="true" />
        <span>{promoBar.label}</span>
        <span className="nl-promo__arrow" aria-hidden="true">
          →
        </span>
      </a>
    </div>
  );
}
