import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Teacher board",
  description: "Open and manage a live Syncvas classroom board.",
  robots: { index: false, follow: false },
};

export default function TeacherLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
