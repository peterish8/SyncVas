import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/providers/convex-client-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Syncvas",
    template: "%s · Syncvas",
  },
  description: "A classroom canvas for teacher-led live boards.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
