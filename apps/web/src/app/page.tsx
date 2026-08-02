import Link from "next/link";

export default function Home() {
  return (
    <div className="marketingHome">
      <main className="marketingMain">
        <section className="marketingHero">
          <div className="marketingHeroCopy marketingFadeUp">
            <p className="marketingHeroPill">
              Family support, gently organized
            </p>
            <h1 className="marketingHeroTitle">
              One bright home for care updates, reminders, and everyday
              check-ins.
            </h1>
            <p className="marketingSectionCopy">
              Kinlight helps your family stay aligned without feeling clinical.
              Share routines, coordinate care moments, and keep everyone
              informed in a calm private space.
            </p>
            <div className="marketingHeroActions">
              <Link href="/auth/sign-up" className="marketingButtonPrimary">
                Create family account
              </Link>
              <Link href="/features" className="marketingButtonSecondary">
                Explore features
              </Link>
            </div>
          </div>
        </section>

        <section className="marketingFeatureGrid">
          {[
            {
              accent: "TL",
              title: "Care timeline",
              body: "Capture updates, medications, and notes in one place everyone can follow.",
              delay: "marketingRevealDelay1",
            },
            {
              accent: "HC",
              title: "Household circles",
              body: "Invite siblings, parents, and trusted caregivers with clear privacy controls.",
              delay: "marketingRevealDelay2",
            },
            {
              accent: "GA",
              title: "Gentle alerts",
              body: "Helpful reminders that feel supportive, not noisy or overwhelming.",
              delay: "marketingRevealDelay3",
            },
          ].map((item) => (
            <article
              key={item.title}
              className={`marketingGlassCard marketingFeatureCard marketingFadeUp ${item.delay}`}
            >
              <span className="marketingIconAccent">{item.accent}</span>
              <h2 className="marketingCardTitle">{item.title}</h2>
              <p className="marketingCardCopy">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="marketingGlassCard marketingCta">
          <div className="marketingCtaActions">
            <div>
              <h2 className="marketingSectionTitle">
                Start with your first household in minutes
              </h2>
              <p className="marketingSectionCopy mt-2 text-sm md:text-base">
                Sign up, create a household, and invite your people. Kinlight
                handles the profile and membership setup so your family can
                focus on what matters.
              </p>
            </div>
            <Link href="/auth/sign-up" className="marketingButtonSubtle">
              Get started
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
