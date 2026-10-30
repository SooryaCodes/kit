// Real content for the landing page: the sample bag job and the showcase collections.
// Bag item boxes were measured by matching each cutout against the photo (percent of the 1536 x 1296 photo).

export const BAG_PHOTO = { src: "/showcase/bag/photo.jpg", width: 1536, height: 1296 };

export interface BagItem {
  id: number;
  name: string;
  /** cutout PNG frame on the photo: left, top, width, height in % */
  png: [number, number, number, number];
  /** tight item bounds on the photo: left, top, width, height in % */
  box: [number, number, number, number];
}

export const BAG_ITEMS: BagItem[] = [
  { id: 0, name: "Backpack", png: [30.469, 7.716, 36.849, 55.941], box: [33.01, 10.73, 31.71, 49.85] },
  { id: 1, name: "Laptop", png: [37.24, 61.42, 22.266, 32.176], box: [38.67, 63.12, 19.34, 28.7] },
  { id: 2, name: "Notebook", png: [64.258, 64.506, 13.737, 22.608], box: [65.3, 65.74, 11.59, 20.06] },
  { id: 3, name: "Smartphone", png: [66.667, 44.29, 7.487, 15.818], box: [67.38, 45.14, 5.99, 14.04] },
  { id: 6, name: "Headphones", png: [16.797, 46.759, 14.844, 12.423], box: [17.58, 47.69, 13.15, 10.49] },
  { id: 7, name: "Cables pouch", png: [18.49, 61.96, 12.305, 13.889], box: [19.14, 62.73, 10.94, 12.27] },
  { id: 8, name: "Power bank", png: [18.359, 78.472, 12.956, 8.719], box: [19.08, 79.32, 11.46, 6.94] },
  { id: 9, name: "Marker", png: [17.708, 25.386, 12.305, 4.244], box: [18.36, 26.16, 10.94, 2.62] },
  { id: 10, name: "Pen", png: [18.294, 24.537, 11.328, 3.241], box: [18.88, 25.23, 10.09, 1.77] },
  { id: 11, name: "Pen", png: [18.555, 23.38, 11.198, 2.932], box: [19.14, 24.07, 9.96, 1.47] },
  { id: 12, name: "E-reader", png: [64.909, 19.29, 10.872, 17.361], box: [65.69, 20.22, 9.24, 15.43] },
  { id: 13, name: "Hard drive", png: [75.326, 41.821, 10.156, 20.216], box: [76.24, 42.9, 8.27, 17.98] },
  { id: 14, name: "Flexible tripod", png: [14.128, 34.491, 19.141, 11.111], box: [15.17, 35.73, 16.99, 8.56] },
  { id: 15, name: "USB stick", png: [76.237, 22.299, 7.096, 11.96], box: [76.76, 22.92, 5.99, 10.65] },
];

export const glb = (set: string, id: number) => `/showcase/${set}/${id}.glb`;
export const cut = (set: string, id: number) => `/showcase/${set}/${id}.png`;

/** Hero scatter around the headline: real products from the sample shop and the sneaker set.
 * x/y are % of the stage, w is % of stage width, r is degrees. */
export interface Placed {
  id: number;
  /** showcase set the item comes from */
  set: "shop" | "sneakers";
  x: number;
  y: number;
  w: number;
  r: number;
  /** depth layer for parallax, 0 (back) to 1 (front) */
  d: number;
  /** cutout pixel size, for the aspect ratio */
  px: [number, number];
}

export const HERO_DESKTOP: Placed[] = [
  { id: 1, set: "shop", x: 3, y: 33, w: 14, r: -9, d: 0.9, px: [220, 194] },
  { id: 3, set: "shop", x: 12, y: 4, w: 10, r: -14, d: 0.5, px: [223, 199] },
  { id: 10, set: "shop", x: 33, y: 1, w: 8, r: 8, d: 0.3, px: [232, 204] },
  { id: 0, set: "shop", x: 58, y: 3, w: 8, r: -12, d: 0.2, px: [225, 197] },
  { id: 4, set: "shop", x: 78, y: 7, w: 11, r: 10, d: 0.4, px: [228, 197] },
  { id: 0, set: "sneakers", x: 89, y: 33, w: 6, r: -8, d: 0.6, px: [187, 278] },
  { id: 12, set: "sneakers", x: 81, y: 57, w: 6.5, r: 18, d: 0.8, px: [175, 305] },
  { id: 9, set: "shop", x: 3, y: 68, w: 10, r: 6, d: 0.5, px: [224, 181] },
  { id: 7, set: "shop", x: 15, y: 84, w: 9, r: 12, d: 0.7, px: [222, 193] },
  { id: 7, set: "sneakers", x: 88, y: 79, w: 5.5, r: -28, d: 0.6, px: [154, 294] },
];

/** Phone: fewer, smaller items above and below the headline. */
export const HERO_MOBILE: Placed[] = [
  { id: 3, set: "shop", x: 3, y: 4, w: 28, r: -12, d: 0.5, px: [223, 199] },
  { id: 12, set: "sneakers", x: 42, y: 3, w: 14, r: 20, d: 0.3, px: [175, 305] },
  { id: 4, set: "shop", x: 68, y: 3, w: 27, r: 10, d: 0.6, px: [228, 197] },
  { id: 1, set: "shop", x: 5, y: 80, w: 28, r: -8, d: 0.9, px: [220, 194] },
  { id: 7, set: "sneakers", x: 44, y: 81, w: 12, r: -24, d: 0.7, px: [154, 294] },
  { id: 7, set: "shop", x: 66, y: 81, w: 27, r: 9, d: 0.8, px: [222, 193] },
];

/** The five templates, each shown with a real collection. */
export interface Format {
  template: "bag" | "desk" | "fit" | "collection" | "seller";
  name: string;
  line: string;
  set: string;
  photo: string;
  /** the Reel card colour, from the paper and cobalt ramps */
  ground: string;
  ink: string;
  items: { id: number; name: string }[];
}

export const FORMATS: Format[] = [
  {
    template: "desk",
    name: "Desk setup",
    line: "Shoot the desk from above. Every gadget gets its own model and a name tag.",
    set: "desk",
    photo: "/showcase/desk/photo.jpg",
    ground: "#e7e4de",
    ink: "#161514",
    items: [
      { id: 1, name: "Laptop" },
      { id: 0, name: "Zero to One" },
      { id: 2, name: "Keyboard" },
      { id: 4, name: "Phone" },
      { id: 6, name: "Mouse" },
      { id: 12, name: "Wallet" },
    ],
  },
  {
    template: "fit",
    name: "Fit check",
    line: "Lay the outfit flat. Shoes, bag and watch come back as a styled Reel.",
    set: "outfit",
    photo: "/showcase/outfit/photo.jpg",
    ground: "#dfe3ff",
    ink: "#0e1660",
    items: [
      { id: 3, name: "Glitter clutch" },
      { id: 4, name: "Watch" },
      { id: 1, name: "Flat shoe" },
      { id: 2, name: "Flat shoe" },
      { id: 5, name: "Eyeshadow" },
    ],
  },
  {
    template: "bag",
    name: "What's in my bag",
    line: "Empty the bag onto the floor. Kit finds all fourteen things and builds each one.",
    set: "bag",
    photo: "/showcase/bag/photo.jpg",
    ground: "#2b44ff",
    ink: "#ffffff",
    items: [
      { id: 0, name: "Backpack" },
      { id: 6, name: "Headphones" },
      { id: 12, name: "E-reader" },
      { id: 1, name: "Laptop" },
      { id: 3, name: "Phone" },
      { id: 14, name: "Tripod" },
    ],
  },
  {
    template: "collection",
    name: "Collection",
    line: "Line up the pairs. Kit knolls them into a grid you would frame.",
    set: "sneakers",
    photo: "/showcase/sneakers/photo.jpg",
    ground: "#161514",
    ink: "#f4f2ee",
    items: [
      { id: 0, name: "Chunky" },
      { id: 7, name: "Court" },
      { id: 12, name: "Runner" },
      { id: 43, name: "Retro" },
      { id: 44, name: "Hiker" },
      { id: 9, name: "Classic" },
    ],
  },
  {
    template: "seller",
    name: "Seller drop",
    line: "Shoot what you sell. Each piece turns into a 3D model you can show off.",
    set: "clutter",
    photo: "/showcase/clutter/photo.jpg",
    ground: "#0e1660",
    ink: "#eef0ff",
    items: [
      { id: 26, name: "Nokia" },
      { id: 10, name: "Flip phone" },
      { id: 2, name: "Wallet" },
      { id: 4, name: "Cup" },
      { id: 16, name: "MP3 player" },
      { id: 8, name: "Siemens" },
    ],
  },
];

export const CREDITS = [
  { what: "Bag", who: "Dean Pugh", where: "Unsplash" },
  { what: "Sneakers", who: "Ahmad Shakir Shamsulbadri", where: "Pexels" },
  { what: "Desk", who: "Oscar Nilsson", where: "Unsplash" },
  { what: "Clutter", who: "Ignat Kushnarev", where: "Unsplash" },
  { what: "Outfit", who: "Hayley Maxwell", where: "Unsplash" },
];
