import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";

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
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Syncvas live classroom whiteboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Syncvas | Live classroom whiteboard",
    description:
      "A live classroom whiteboard for teacher-led lessons and student participation.",
    images: ["/opengraph-image"],
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
