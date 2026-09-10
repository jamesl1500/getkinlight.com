import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.scss";
import styles from "../styles/ui.module.scss";

import { ObservabilityProvider } from "@/components/observability/observability-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

const headline = Fraunces({
  variable: "--font-headline",
  subsets: ["latin"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kinlight",
    template: "%s | Kinlight",
  },
  description:
    "A calm, connected family space for care updates, shared routines, and everyday support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headline.variable} ${body.variable} h-full antialiased`}
    >
      <body className={`${styles.body} min-h-full`}>
        <ObservabilityProvider />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
