import type { MetadataRoute } from "next";

// 生产环境部署后改成真实域名（或读取 process.env.NEXT_PUBLIC_SITE_URL）
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "/",
    "/forex",
    "/gold",
    "/crypto",
    "/us-stocks",
    "/a-shares",
    "/academy",
    "/twitter",
    "/login",
    "/register",
  ];
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
