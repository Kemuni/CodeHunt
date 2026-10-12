import { Hero } from "@/components/landing/hero";
import { SiteHeader } from "@/components/landing/site-header";

export default function Home() {
  return (
    <div id="top" className="min-w-[1440px] overflow-hidden">
      <SiteHeader />
      <main>
        <Hero />
      </main>
    </div>
  );
}
