"use client";

import { MotionConfig } from "motion/react";

import { AuralisField } from "@/components/landing/auralis-field";
import { LandingCapabilities } from "@/components/landing/landing-capabilities";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingShowcase } from "@/components/landing/landing-showcase";
import {
  LandingHowItWorks,
  LandingIntro,
  LandingTeacher,
} from "@/components/landing/landing-sections";
import { SiteStructuredData } from "@/components/seo/site-structured-data";
import { LandingNavigation } from "@/components/ui/landing-navigation";
import { SiteFooter } from "@/components/ui/site-footer";

/** Client landing shell — Motion + SyncVas-tuned Auralis field. */
export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <main className="origin-landing origin-landing-motion origin-landing-auralis">
        <AuralisField className="origin-auralis-layer" />
        <div className="origin-landing-foreground">
          <SiteStructuredData />
          <LandingNavigation />
          <LandingHero />
          <LandingHowItWorks />
          <LandingIntro />
          <LandingCapabilities />
          <LandingShowcase />
          <LandingTeacher />
          <SiteFooter />
        </div>
      </main>
    </MotionConfig>
  );
}
