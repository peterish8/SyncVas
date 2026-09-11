import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

export default convexAuthNextjsMiddleware();

export const config = {
  // Run on all routes except static assets.
  //
  // Every entry must start with "/" — Next rejects the whole middleware config
  // otherwise ("source must start with / at matcher[0]") and the dev server
  // exits. The leading slash is the only difference from the older pattern.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
