import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const production =
    process.env.KINLIGHT_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  return production
    ? { rules: { userAgent: "*", allow: "/" } }
    : { rules: { userAgent: "*", disallow: "/" } };
}
