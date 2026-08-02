import Link from "next/link";
import styles from "./site-header.module.scss";

const links = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
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
              <Link href="/" className={styles.brand}>
                Kinlight
              </Link>
            </div>
            <nav className={`${styles.desktopNav} hidden md:flex`}>
              <ul>
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      key={link.href}
                      href={link.href}
                      className={styles.link}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className={styles.actions}>
              <Link href="/auth/sign-in" className={styles.ghostAction}>
                Sign in
              </Link>
              <Link href="/auth/sign-up" className={styles.primaryAction}>
                Join family
              </Link>
            </div>
          </div>

          <nav className={`${styles.mobileNav} flex md:hidden`}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles.mobileNavLink}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.glowA} aria-hidden />
        <div className={styles.glowB} aria-hidden />
      </div>
    </header>
  );
}
