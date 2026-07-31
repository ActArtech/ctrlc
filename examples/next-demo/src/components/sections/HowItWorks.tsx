import { howItWorks } from "@/content/home";

/** Numbered steps from connect to shared briefing. */
export function HowItWorks() {
  return (
    <section className="nl-how" id="how-it-works">
      <div className="nl-container">
        <div className="nl-heading-block">
          <p className="nl-tag">{howItWorks.eyebrow}</p>
          <h2 className="nl-h2">{howItWorks.title}</h2>
        </div>
        <ol className="nl-how__steps">
          {howItWorks.steps.map((step, i) => (
            <li key={step.title} className="nl-how__step">
              <span className="nl-how__num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="nl-how__copy">
                <h3 className="nl-how__title">{step.title}</h3>
                <p className="nl-how__body">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
