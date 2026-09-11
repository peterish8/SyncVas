import Link from "next/link";
import type { ReactNode } from "react";

import { SeoPageStructuredData } from "@/components/seo/seo-page-structured-data";
import { SiteFooter } from "@/components/ui/site-footer";
import { SyncvasLogo } from "@/components/ui/syncvas-logo";

type SeoPageProps = {
  path: string;
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function SeoPage({ path, eyebrow, title, intro, children }: SeoPageProps) {
  return (
    <main className="origin-landing origin-seo-page">
      <SeoPageStructuredData title={title} description={intro} path={path} />
      <nav className="origin-nav" aria-label="Primary navigation">
        <Link className="origin-mark" href="/" aria-label="Syncvas home"><SyncvasLogo /></Link>
        <div className="origin-links">
          <Link href="/for-teachers">For teachers</Link>
          <Link href="/for-students">For students</Link>
          <Link href="/guides/live-classroom-whiteboard">Guide</Link>
        </div>
        <div className="origin-nav-controls"><Link className="origin-nav-action origin-button-join" href="/join">Join a class <span aria-hidden="true">↗</span></Link></div>
      </nav>

      <article className="origin-seo-article">
        <header className="origin-seo-header">
          <p className="origin-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="origin-seo-lede">{intro}</p>
        </header>
        <div className="origin-seo-content">{children}</div>
        <nav className="origin-seo-related" aria-label="More from Syncvas">
          <p className="origin-eyebrow">Keep exploring</p>
          <div>
            <Link href="/">Syncvas overview <span aria-hidden="true">↗</span></Link>
            <Link href="/for-teachers">For teachers <span aria-hidden="true">↗</span></Link>
            <Link href="/for-students">For students <span aria-hidden="true">↗</span></Link>
            <Link href="/guides/live-classroom-whiteboard">Live whiteboard guide <span aria-hidden="true">↗</span></Link>
          </div>
        </nav>
      </article>

      <SiteFooter />
    </main>
  );
}
