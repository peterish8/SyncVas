import type { Metadata } from "next";

import { FailureScreen } from "@/components/ui/failure-screen";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <FailureScreen
      title="We could not find that page"
      message="The link may be out of date, or the class it pointed to has ended."
      recovery="If you were joining a class, ask your teacher for the current six-character code."
    />
  );
}
