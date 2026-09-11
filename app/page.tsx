import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Live classroom whiteboard for teachers and students",
  description:
    "Syncvas is a live classroom whiteboard for stylus-led teaching. Share a room by QR code, let students follow or explore locally, and collect anonymous doubts.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return <LandingPage />;
}
