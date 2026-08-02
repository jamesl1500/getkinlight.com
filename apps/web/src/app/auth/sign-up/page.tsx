import { AuthForm } from "@/components/auth/auth-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import styles from "./page.module.scss";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = safeRedirectPath(next);

  return (
    <section className={styles.signUpShell}>
      <aside className={styles.featurePanel}>
        <div className={styles.featureBody}>
          <p className={styles.eyebrow}>Why families choose Kinlight</p>
          <h1 className={styles.title}>
            Build one calm place for every update that matters.
          </h1>
          <p className={styles.copy}>
            Create your account to keep routines, reminders, and care notes in a
            space that feels simple and private for everyone in your family.
          </p>

          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} />
              Share timeline updates once, so everyone stays informed.
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} />
              Organize reminders and tasks without noisy group chats.
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} />
              Invite relatives and caregivers with clear access controls.
            </li>
          </ul>

          <div className={styles.proof}>
            <div className={styles.proofCell}>
              <p className={styles.proofValue}>Private</p>
              <p className={styles.proofLabel}>Household access</p>
            </div>
            <div className={styles.proofCell}>
              <p className={styles.proofValue}>Simple</p>
              <p className={styles.proofLabel}>Daily use</p>
            </div>
            <div className={styles.proofCell}>
              <p className={styles.proofValue}>Calm</p>
              <p className={styles.proofLabel}>By design</p>
            </div>
          </div>
        </div>
      </aside>

      <div className={styles.formPane}>
        <AuthForm mode="sign-up" tone="footer" redirectTo={redirectTo} />
      </div>
    </section>
  );
}
