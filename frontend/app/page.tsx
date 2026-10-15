import { Hero } from "@/components/landing/hero";
import { CompanyMarquee } from "@/components/landing/company-marquee";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { HowToStart } from "@/components/landing/how-to-start";
import { PortfolioInstruction } from "@/components/landing/portfolio-instruction";

export default function Home() {
  return (
    <div id="top" className="min-w-[1440px] overflow-hidden">
      <SiteHeader />
      <main className="flex flex-col items-center">
        <Hero />
        <CompanyMarquee />
        <HowToStart/>
        <PortfolioInstruction/>
      </main>
      <SiteFooter />
    </div>
  );
}
