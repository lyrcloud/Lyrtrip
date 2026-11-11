import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

// Public pages only: account, admin and checkout pages are left out
const PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/rewards", priority: 0.7 },
  { path: "/talent", priority: 0.6 },
  { path: "/dash/restaurants", priority: 0.6 },
  { path: "/dash/grocery", priority: 0.6 },
  { path: "/dash/pickup", priority: 0.6 },
  { path: "/privacy", priority: 0.3 },
  { path: "/data-deletion", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, priority }) => ({
    url: `${SITE_URL}${path || "/"}`,
    changeFrequency: "weekly",
    priority,
  }));
}
