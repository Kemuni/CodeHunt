import { Hero } from "@/components/landing/hero";
import { CompanyMarquee } from "@/components/landing/company-marquee";
import { SiteHeader } from "@/components/landing/site-header";
import { HowToStart } from "@/components/landing/how-to-start";

export default function Home() {
  return (
    <div id="top" className="min-w-[1440px] overflow-hidden">
      <SiteHeader />
      <main>
        <Hero />
        <CompanyMarquee />
        <HowToStart/>
      </main>
    </div>
  );
}
