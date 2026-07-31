import { features } from "@/content/home";

/** Three-up product feature cards. */
export function Features() {
  return (
    <section className="nl-features" id="features">
      <div className="nl-container">
        <div className="nl-heading-block">
          <p className="nl-tag">{features.eyebrow}</p>
          <h2 className="nl-h2">{features.title}</h2>
        </div>
        <div className="nl-features__grid">
          {features.items.map((item, i) => (
            <article key={item.title} className="nl-feature-card">
              <span className="nl-feature-card__icon" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="nl-feature-card__title">{item.title}</h3>
              <p className="nl-feature-card__body">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
