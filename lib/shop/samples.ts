// Sample shops made from free-licence stock photos: their photo credit, and a note that orders go nowhere.

export interface SampleNote {
  credit: string;
  creditUrl: string;
}

export const SAMPLE_SHOPS: Record<string, SampleNote> = {
  "sample-shop": { credit: "Photo by Claudio Schwarz on Unsplash", creditUrl: "https://unsplash.com/photos/0NokUjOSEso" },
};
