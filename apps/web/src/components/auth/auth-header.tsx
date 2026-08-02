import Link from "next/link";
import styles from "./auth-header.module.scss";

export function AuthHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.panel}>
        <div className={styles.content}>
          <div className={styles.row}>
            <div className={styles.brandLockup}>
              <svg
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={styles.logo}
                aria-hidden
              >
                <path
                  d="M16 3L19.7 11.1L28.5 12.1L22 18.1L23.7 26.8L16 22.4L8.3 26.8L10 18.1L3.5 12.1L12.3 11.1L16 3Z"
                  fill="currentColor"
                />
              </svg>
              <div className={styles.brandBlock}>
                <p className={styles.kicker}>Kinlight</p>
              </div>
            </div>
            <nav className={styles.links}>
              <Link href="/auth/sign-in" className={styles.link}>
                Sign in
              </Link>
            </nav>
          </div>
        </div>

        <div className={styles.glowA} aria-hidden />
        <div className={styles.glowB} aria-hidden />
      </div>
    </header>
  );
}
