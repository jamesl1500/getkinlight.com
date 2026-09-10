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
        { href: "/about", label: "About" },
        { href: "/how-it-works", label: "How it works" },
      ],
    },
    {
      label: "Resources",
      links: [
        { href: "/features", label: "Features" },
        { href: "/pricing", label: "Pricing" },
        { href: "/faq", label: "FAQ" },
      ],
    },
    {
      label: "Account",
      links: [
        { href: "/auth/sign-in", label: "Sign in" },
        { href: "/auth/sign-up", label: "Create account" },
        { href: "/contact", label: "Contact" },
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
              <Link href="/terms" className={styles.legalLink}>
                Terms of Use
              </Link>
              <Link href="/privacy" className={styles.legalLink}>
                Privacy Notice
              </Link>
              <Link href="/cookies" className={styles.legalLink}>
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>

        <div className={styles.glowA} aria-hidden />
        <div className={styles.glowB} aria-hidden />
      </div>
    </footer>
  );
}
