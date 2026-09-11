import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { siteUrl } from "@/lib/site-url";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Syncvas | Live classroom whiteboard",
    template: "%s · Syncvas",
  },
  description:
    "A live classroom whiteboard for teachers and students. Teach with a stylus, share the board by QR code, and let students follow, explore, and ask anonymously.",
  applicationName: "Syncvas",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Syncvas",
    title: "Syncvas | Live classroom whiteboard",
    description:
      "Teach live on a shared classroom whiteboard. Students join by QR code, follow the lesson, and ask anonymous doubts.",
    locale: "en_US",
    images: [{ url: "/opengraph-image.png", width: 1733, height: 907, alt: "Syncvas live classroom whiteboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Syncvas | Live classroom whiteboard",
    description:
      "A live classroom whiteboard for teacher-led lessons and student participation.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html suppressHydrationWarning lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable}`}>
        <body className="font-sans antialiased">
          {/*
            Stamps the stored theme onto <html> before first paint. ThemeToggle
            only applies it from an effect, so any route that does not mount a
            toggle — the teacher sign-in page among them — otherwise renders
            light no matter what the teacher chose.

            This is a raw tag on purpose. next/script with
            strategy="beforeInteractive" does not emit an executable inline
            script into the streamed HTML from an App Router layout; it only
            reaches the RSC payload, which runs after hydration and so paints
            the wrong theme first. React logs a development warning about
            rendering a script tag; the tag is still what the browser executes
            during parse, which is the whole point.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                'try{document.documentElement.dataset.theme=localStorage.getItem("syncvas-theme")==="dark"?"dark":"light"}catch(e){}',
            }}
          />
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
