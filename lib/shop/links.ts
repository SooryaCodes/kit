// Links a shop page hands to its visitors. Shared by the server page and the client components.

/** wa.me link with the order message prefilled. Digits only in the path, as WhatsApp requires. */
export function whatsappOrderUrl(number: string, product: { name: string; price: number | null; currency: string }, pageUrl: string): string {
  const price = product.price === null ? "" : ` (${formatPrice(product.price, product.currency)})`;
  const text = `Hi, I'd like ${product.name}${price} from ${pageUrl}`;
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
