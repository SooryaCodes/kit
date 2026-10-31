import { Closing, Footer } from "@/components/landing/closing";
import { SiteHeader } from "@/components/app/site-header";
import { Hero } from "@/components/landing/hero";
import { Models } from "@/components/landing/models";
import { Creators, CustomerView, Problem, SellerStudio } from "@/components/landing/shop-sections";
import { StudioDemo } from "@/components/landing/studio-demo";
import type { EditorPage } from "@/lib/shop/editor";
import { getShop } from "@/lib/shop/shops";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { Story } from "@/components/landing/story";
import { Studio } from "@/components/landing/studio";

// the studio section runs on the live sample shop; refreshed every few minutes
export const revalidate = 300;

async function sampleStudio(): Promise<EditorPage | null> {
  const shop = await getShop("sample-shop").catch(() => null);
  if (!shop) return null;
  return {
    id: shop.id,
    slug: shop.slug,
    mode: shop.mode,
    title: shop.title,
    handle: shop.handle,
    whatsapp: null,
    affiliateTag: null,
    published: true,
    products: shop.products.map((p, n) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      sizeM: p.sizeM,
      link: p.link,
      offer: p.offer,
      arPose: p.arPose,
      hidden: false,
      order: n,
      cutoutUrl: p.cutoutUrl,
      glbUrl: p.glbUrl,
    })),
  };
}

export default async function Home() {
  const studio = await sampleStudio();
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
      {studio && (
        <SellerStudio>
          <StudioDemo initial={studio} />
        </SellerStudio>
      )}
      <Models />
      <Creators />
      <Studio />
      <Closing />
      <Footer />
    </main>
  );
}
