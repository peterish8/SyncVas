import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Student classroom",
  description: "Join a live Syncvas classroom board.",
  robots: { index: false, follow: false },
};

export default function StudentLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
