import type { Product } from "./types";

/** YYYY-MM-DD in the product's timezone. */
export function studyDate(product: Pick<Product, "timezone">, now = new Date()): string {
  // The sv-SE locale formats dates as ISO YYYY-MM-DD.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: product.timezone }).format(now);
}

/** "<date> <product name> synthetic testing", e.g. "2026-11-16 K-Rauta synthetic testing". */
export function studyTitle(product: Pick<Product, "name" | "timezone">, now = new Date()): string {
  return `${studyDate(product, now)} ${product.name} synthetic testing`;
}
