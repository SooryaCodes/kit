// Reel templates. A template bundles copy, layout, animation, colour and the background prompt;
// every field can be overridden by the user in the studio.

export type AnimationPreset = "fly-in" | "orbit" | "knolling";

export interface Template {
  id: TemplateId;
  name: string;
  /** what the user photographs */
  prompt: string;
  /** default Reel title */
  title: string;
  animation: AnimationPreset;
  /** default background colour from the red ramp */
  background: string;
  /** Muse Image prompt for the themed world behind the items */
  worldPrompt: string;
  /** show brand and price labels by default */
  labels: "name" | "name-brand" | "name-price";
}

export type TemplateId = "bag" | "desk" | "fit" | "collection" | "seller";

export const TEMPLATES: Record<TemplateId, Template> = {
  bag: {
    id: "bag",
    name: "What's in my bag",
    prompt: "Empty your bag and lay everything out flat, from above.",
    title: "What's in my bag",
    animation: "fly-in",
    background: "#dc1928",
    worldPrompt: "a clean studio tabletop seen from above, soft daylight, minimal",
    labels: "name-brand",
  },
  desk: {
    id: "desk",
    name: "Desk setup",
    prompt: "Shoot your desk from above or at a slight angle, in good light.",
    title: "My desk setup",
    animation: "orbit",
    background: "#952625",
    worldPrompt: "a calm minimal workspace backdrop, warm window light",
    labels: "name-brand",
  },
  fit: {
    id: "fit",
    name: "Fit check",
    prompt: "Lay out the outfit: clothes, shoes and accessories, flat, from above.",
    title: "Today's fit",
    animation: "fly-in",
    background: "#f5c2bc",
    worldPrompt: "a soft fashion editorial backdrop, paper texture, daylight",
    labels: "name-brand",
  },
  collection: {
    id: "collection",
    name: "Collection",
    prompt: "Line up your collection with a little space between each piece.",
    title: "The collection",
    animation: "knolling",
    background: "#4a1514",
    worldPrompt: "a museum display shelf backdrop, gallery lighting",
    labels: "name",
  },
  seller: {
    id: "seller",
    name: "Seller drop",
    prompt: "Arrange the products you sell on a plain surface, from above.",
    title: "New drop",
    animation: "knolling",
    background: "#fdf3f2",
    worldPrompt: "a bright product studio backdrop, seamless paper",
    labels: "name-price",
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && v in TEMPLATES;
}
