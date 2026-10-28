import { Closing, Footer } from "@/components/landing/closing";
import { Hero, Nav } from "@/components/landing/hero";
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
      <div className="relative bg-studio">
        <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
        <Nav />
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
