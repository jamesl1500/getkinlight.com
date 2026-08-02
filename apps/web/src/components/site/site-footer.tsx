import Link from "next/link";
import styles from "./site-footer.module.scss";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();
  const siteName = "Kinlight";

  const navColumns = [
    {
      label: "Company",
      links: [
        { href: "/", label: "Home" },
        { href: "/features", label: "About" },
        { href: "/features", label: "Services" },
      ],
    },
    {
      label: "Resources",
      links: [
        { href: "/pricing", label: "Plans" },
        { href: "/features", label: "Resources" },
        { href: "/auth/sign-up", label: "Join Us" },
      ],
    },
    {
      label: "Account",
      links: [
        { href: "/auth/sign-in", label: "Sign in" },
        { href: "/auth/sign-up", label: "Create account" },
        { href: "/auth/forgot-password", label: "Reset password" },
      ],
    },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.panel}>
        <div className={styles.content}>
          <div className={styles.topRow}>
            <div className={styles.navColumns}>
              {navColumns.map((column) => (
                <nav
                  key={column.label}
                  className={styles.navColumn}
                  aria-label={`${column.label} links`}
                >
                  {column.links.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={styles.navLink}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              ))}
            </div>
            <div className={styles.socialColumn}>
              <a href="#" className={styles.socialLink}>
                FACEBOOK
              </a>
              <a href="#" className={styles.socialLink}>
                INSTAGRAM
              </a>
              <a href="#" className={styles.socialLink}>
                YOUTUBE
              </a>
            </div>
          </div>

          <p className={styles.brandWordmark}>{siteName}</p>

          <div className={styles.bottomRow}>
            <p className={styles.copy}>
              &copy; {currentYear} {siteName}. All rights reserved.
            </p>
            <div className={styles.legalLinks}>
              <a href="#" className={styles.legalLink}>
                Terms of Use
              </a>
              <a href="#" className={styles.legalLink}>
                Privacy Notice
              </a>
              <a href="#" className={styles.legalLink}>
                Cookie Policy
              </a>
            </div>
          </div>
        </div>

        <div className={styles.glowA} aria-hidden />
        <div className={styles.glowB} aria-hidden />
      </div>
    </footer>
  );
}
