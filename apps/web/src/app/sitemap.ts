import type { MetadataRoute } from "next";

const SITE_URL = (
  process.env.KINLIGHT_SITE_URL ?? "https://getkinlight.com"
).replace(/\/$/, "");

const routes = [
  "/",
  "/features",
  "/how-it-works",
  "/pricing",
  "/about",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
