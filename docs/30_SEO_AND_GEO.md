# 30 — SEO and AI-search discoverability

## Scope

Syncvas has a public marketing surface (`/`), a public join entry (`/join`),
and three evergreen education pages. Teacher, student-session, API, and
code-specific classroom URLs are operational surfaces and must not be indexed.

## Implemented contract

- `app/layout.tsx` owns the default title, description, canonical origin,
  Open Graph/Twitter metadata, and Google preview directives.
- `components/seo/site-structured-data.tsx` emits server-rendered JSON-LD for
  `Organization`, `WebSite`, and `WebApplication` on the homepage.
- `app/opengraph-image.tsx` provides a consistent, generated social preview for
  shared public URLs.
- `app/robots.ts` allows public content and blocks `/api/`, `/teacher`, and
  `/student/` while advertising the sitemap.
- `app/sitemap.ts` also lists the three evergreen public education pages:
  `/for-teachers`, `/for-students`, and
  `/guides/live-classroom-whiteboard`.
- `app/llms.txt/route.ts` gives non-Google AI crawlers a concise map of public
  pages and product facts. Google says `llms.txt` is optional and does not
  improve Google rankings; it is maintained as a machine-readable convenience.
- Route layouts add `noindex, nofollow` to teacher, student, and
  `/join/[code]` surfaces.
- The homepage and three evergreen pages contain server-rendered definitions,
  workflows, and question-led explanations rather than keyword stuffing.

## Canonical origin

Set `NEXT_PUBLIC_APP_URL` to the real HTTPS production origin before deploy.
The value drives canonical URLs, JSON-LD URLs, `robots.txt`, `sitemap.xml`,
and `llms.txt`. Local development intentionally falls back to
`http://localhost:3000`.

## Content decisions

The public copy is people-first and specific to Syncvas: teacher-led writing,
QR/short-code joining, independent student navigation, Follow Teacher,
anonymous doubts, and final-board preservation. Do not create thin pages for
keyword variants or publish unsupported claims. Add original classroom
examples, screenshots, or measured product evidence as the product gains them.

## Verification checklist

1. Run a production build and inspect `/`, `/robots.txt`, `/sitemap.xml`, and
   `/llms.txt` in the deployed environment.
2. Confirm the production `NEXT_PUBLIC_APP_URL` is HTTPS and matches the
   preferred domain.
3. Submit the sitemap in Google Search Console and monitor indexing and Core
   Web Vitals there; static audits are not Google ranking guarantees.
4. Validate JSON-LD with Schema Markup Validator and inspect rendered HTML as
   an anonymous crawler.

## Sources

- Google Search Central, “Guide to optimizing for generative AI features in
  Google Search”: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google Search Central, “SEO Starter Guide”: https://developers.google.com/search/docs/fundamentals/get-on-google
- Next.js Metadata API and file conventions:
  https://nextjs.org/docs/app/getting-started/metadata-and-og-images
