import type { Product } from "./types";

/** YYYY-MM-DD in the product's timezone. */
export function studyDate(product: Pick<Product, "timezone">, now = new Date()): string {
  // The sv-SE locale formats dates as ISO YYYY-MM-DD.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: product.timezone }).format(now);
}

/**
 * "<date> <product name> synthetic testing #<run>", e.g. "2026-11-16 K-Rauta synthetic testing #2".
 * `runNumber` counts the studies for that product on that date.
 */
export function studyTitle(product: Pick<Product, "name" | "timezone">, runNumber: number, now = new Date()): string {
  return `${studyDate(product, now)} ${product.name} synthetic testing #${runNumber}`;
}
