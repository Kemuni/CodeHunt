import { Hero } from "@/components/landing/hero";
import { CompanyMarquee } from "@/components/landing/company-marquee";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { HowToStart } from "@/components/landing/how-to-start";
import { PortfolioInstruction } from "@/components/landing/portfolio-instruction";
import FAQ from "@/components/landing/faq";
import { LandingSection } from "@/components/landing/landing-section";
import ContactMeSection from "@/components/landing/contact-me";

export default function Home() {
  return (
    <div id="top" className="w-full overflow-hidden">
      
      <main className="flex flex-col items-center [&>div:not(:first-child)]:mt-14 [&>div:last-child]:mb-28">
        <Hero />
        <LandingSection subtitle="Совершенствуеся решая" title="Задачи Big Tech компаний">
          <CompanyMarquee />
        </LandingSection>
        <LandingSection subtitle="Основа" title="Как начать?">
          <HowToStart/> 
        </LandingSection>
        <ContactMeSection type="candidate" />
        <LandingSection subtitle="Что делать если" title="Нет своего портфолио">
          <PortfolioInstruction/>
        </LandingSection>
        <LandingSection subtitle="Если что-то не нашли" title="Часто задаваемые вопросы">
          <FAQ type="candidate"/>
        </LandingSection>
      </main>
      
    </div>
  );
}
