import { hero } from "@/content/home";
import { Reveal } from "./shared/Reveal";

export function Hero() {
  return (
    <section className="pc-hero pc-section">
      <Reveal>
        <h1 className="pc-hero__title">{hero.title}</h1>
        <p className="pc-hero__body">{hero.body}</p>
        <a className="pc-btn pc-btn--primary" href={hero.primaryHref}>
          {hero.primaryCta}
        </a>
      </Reveal>
    </section>
  );
}
