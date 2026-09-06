/**
 * Public origin used by metadata, structured data, robots, and sitemaps.
 * Set NEXT_PUBLIC_APP_URL to the real production origin before deploying.
 */
export const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, siteUrl).toString();
}
