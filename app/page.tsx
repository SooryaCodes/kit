import { Closing, Footer } from "@/components/landing/closing";
import { SiteHeader } from "@/components/app/site-header";
import { Hero } from "@/components/landing/hero";
import { Models } from "@/components/landing/models";
import { Creators, CustomerView, Problem } from "@/components/landing/shop-sections";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { Story } from "@/components/landing/story";
import { Studio } from "@/components/landing/studio";

export default function Home() {
  return (
    <main className="relative overflow-x-clip bg-paper text-ink">
      <SmoothScroll />
      <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
      <SiteHeader />
      <div className="relative -mt-16 bg-studio pt-16 md:-mt-20 md:pt-20">
        <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
        <Hero />
      </div>
      <Problem />
      <Story />
      <CustomerView />
      <Models />
      <Creators />
      <Studio />
      <Closing />
      <Footer />
    </main>
  );
}
