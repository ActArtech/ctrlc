import { cta } from "@/content/home";

/** Conversion band with trial CTA. */
export function Cta() {
  return (
    <section className="nl-cta" id={cta.id}>
      <div className="nl-container">
        <div className="nl-cta__card">
          <div className="nl-cta__copy">
            <h2 className="nl-h2 nl-cta__title">{cta.title}</h2>
            <p className="nl-cta__body">{cta.body}</p>
            <p className="nl-cta__note">{cta.note}</p>
          </div>
          <a className="nl-btn nl-btn--on-dark" href={cta.primaryCta.href}>
            {cta.primaryCta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
