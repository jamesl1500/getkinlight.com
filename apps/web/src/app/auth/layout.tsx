import styles from "../../styles/pages/auth/layout.module.scss";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className={styles.authShell}>
      <div className={styles.authStage}>
        <div className={styles.authStageInner}>{children}</div>
      </div>
    </main>
  );
}
