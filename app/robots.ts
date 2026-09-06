import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const publicRules = {
    userAgent: "*",
    allow: "/",
    disallow: ["/api/", "/teacher", "/student/"],
  };

  return {
    rules: [
      publicRules,
      {
        userAgent: ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot"],
        allow: "/",
        disallow: ["/api/", "/teacher", "/student/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
