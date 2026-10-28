// Real cutouts from the sample bag job, placed for the hero direction prototypes.
// x/y are % of the hero stage, w is % of stage width, r is rotation in degrees.

export interface Placed {
  src: string;
  name: string;
  x: number;
  y: number;
  w: number;
  r: number;
}

const c = (id: number) => `/showcase/bag/${id}.png`;

/** Scattered around a centred headline, largest items low and to the sides. */
export const SCATTER: Placed[] = [
  { src: c(0), name: "Backpack", x: 6, y: 34, w: 17, r: -8 },
  { src: c(1), name: "Laptop with keyboard", x: 74, y: 52, w: 21, r: 7 },
  { src: c(2), name: "Notebook", x: 80, y: 6, w: 11, r: 12 },
  { src: c(6), name: "Headphones", x: 15, y: 4, w: 11, r: -14 },
  { src: c(12), name: "E-reader", x: 58, y: 70, w: 8, r: -10 },
  { src: c(3), name: "Smartphone", x: 30, y: 74, w: 6, r: 14 },
  { src: c(14), name: "Flexible tripod", x: 40, y: 2, w: 9, r: 18 },
  { src: c(7), name: "Cables pouch", x: 3, y: 72, w: 10, r: 6 },
  { src: c(13), name: "External hard drive", x: 89, y: 30, w: 8, r: -6 },
  { src: c(10), name: "Pen", x: 64, y: 8, w: 9, r: -32 },
];

/** A tidy knolling row for the showroom plinth. */
export const ROW: Placed[] = [
  { src: c(6), name: "Headphones", x: 0, y: 0, w: 11, r: 0 },
  { src: c(12), name: "E-reader", x: 0, y: 0, w: 7, r: 0 },
  { src: c(0), name: "Backpack", x: 0, y: 0, w: 17, r: 0 },
  { src: c(3), name: "Smartphone", x: 0, y: 0, w: 5, r: 0 },
  { src: c(1), name: "Laptop with keyboard", x: 0, y: 0, w: 17, r: 0 },
  { src: c(7), name: "Cables pouch", x: 0, y: 0, w: 9, r: 0 },
  { src: c(14), name: "Flexible tripod", x: 0, y: 0, w: 9, r: 0 },
];
