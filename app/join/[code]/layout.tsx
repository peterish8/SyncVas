import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Join classroom",
  description: "Join a live Syncvas classroom with a teacher-provided code.",
  robots: { index: false, follow: false },
};

export default function JoinCodeLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
