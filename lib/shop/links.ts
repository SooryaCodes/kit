// Links a shop page hands to its visitors. Shared by the server page and the client components.

/** wa.me link with the order message prefilled. Digits only in the path, as WhatsApp requires. */
export function whatsappOrderUrl(number: string, product: { name: string; price: number | null; currency: string }, pageUrl: string, message?: string): string {
  const price = product.price === null ? "" : ` (${formatPrice(product.price, product.currency)})`;
  const text = message ? `${message} ${pageUrl}` : `Hi, I'd like ${product.name}${price} from ${pageUrl}`;
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** "45 cm" or "1.2 m": the longest side, as a shopper reads it. */
export function formatSize(sizeM: number): string {
  return sizeM >= 1 ? `${Math.round(sizeM * 100) / 100} m` : `${Math.round(sizeM * 100)} cm`;
}

export function formatPrice(price: number, currency: string): string {
  return `${currency}${price.toLocaleString("en-IN")}`;
}

/** In-app browsers (Instagram, Facebook, WhatsApp) often can't open AR; the page suggests Safari or Chrome. */
export function isInAppBrowser(userAgent: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\//i.test(userAgent);
}

export type ReferenceKind = "phone" | "a4" | "laptop";

/** The everyday object a product is shown beside in its size picture, with its real dimensions. */
export function referenceFor(sizeM: number): { kind: ReferenceKind; label: string; widthCm: number; heightCm: number } {
  if (sizeM <= 0.18) return { kind: "phone", label: "a phone", widthCm: 7.1, heightCm: 14.7 };
  if (sizeM <= 0.34) return { kind: "a4", label: "an A4 sheet", widthCm: 21, heightCm: 29.7 };
  return { kind: "laptop", label: "a 14-inch laptop", widthCm: 32.3, heightCm: 22.5 };
}
