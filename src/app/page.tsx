import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { ProgramIntro } from "@/components/program-intro";
import { LearningTracks } from "@/components/learning-tracks";
import { HowItWorks, ScheduleSection, Faq, FinalCta } from "@/components/sections";
import { RegistrationSection } from "@/components/registration-section";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <ProgramIntro />
        <LearningTracks />
        <HowItWorks />
        <ScheduleSection />
        <Faq />
        <RegistrationSection />
        <FinalCta />
      </main>
    </>
  );
}
