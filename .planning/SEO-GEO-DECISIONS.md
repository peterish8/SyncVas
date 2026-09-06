# SEO/GEO implementation decisions

Date: 2026-09-05

## Decision

Improve Syncvas discoverability through standard technical SEO and useful,
server-rendered product explanations. Treat “GEO” as SEO fundamentals applied
to AI search surfaces, not as a separate ranking hack.

## Evidence used

The local `C:\Users\nithy\Desktop\aclones\claude-seo` pack was used as a
checklist for Google metadata, crawlability, structured data, citability, and
agent-friendly accessibility. Google's current Search Central guidance remains
the authority: indexing eligibility, clear structure, helpful original content,
and accessible rendering matter; `llms.txt`, forced chunking, and keyword
variants are not Google ranking requirements.

## Files changed

- `app/layout.tsx`
- `app/page.tsx`
- `app/robots.ts`
- `app/sitemap.ts`
- `app/llms.txt/route.ts`
- `app/teacher/layout.tsx`
- `app/student/layout.tsx`
- `app/join/[code]/layout.tsx`
- `app/styles/landing.css`
- `components/seo/site-structured-data.tsx`
- `components/seo/seo-page.tsx`
- `components/seo/seo-page-structured-data.tsx`
- `lib/site-url.ts`
- `app/for-teachers/page.tsx`
- `app/for-students/page.tsx`
- `app/guides/live-classroom-whiteboard/page.tsx`
- `app/opengraph-image.tsx`
- `.env.example`

## Boundary

Only public marketing, join, and three evergreen education pages are listed in
the sitemap. Classroom routes contain session state and are explicitly noindex. No claims about
traffic, rankings, AI citations, or customer outcomes are asserted without
first-party evidence. The optional `llms.txt` endpoint is documented as a
non-Google convenience, not a ranking lever.

## Follow-up

After deployment, set `NEXT_PUBLIC_APP_URL`, submit the sitemap to Search
Console, validate JSON-LD, and use Search Console plus field Core Web Vitals as
the source of truth for ongoing measurement.
