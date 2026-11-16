import fs from "fs/promises";
import path from "path";
import { config, type UrlPolicy } from "./config";
import { ProductSchema, type Product } from "./types";

/** Products live as JSON files in /products, like personas. */
export async function listProducts(): Promise<{ products: Product[]; errors: string[] }> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(config.productsDir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  } catch {
    return { products: [], errors: [`Products folder not found: ${config.productsDir}`] };
  }
  const products: Product[] = [];
  const errors: string[] = [];
  for (const file of files.sort()) {
    try {
      const parsed = ProductSchema.safeParse(JSON.parse(await fs.readFile(path.join(config.productsDir, file), "utf8")));
      if (parsed.success) products.push(parsed.data);
      else errors.push(`${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    } catch (err) {
      errors.push(`${file}: ${(err as Error).message}`);
    }
  }
  return { products, errors };
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return (await listProducts()).products.find((p) => p.id === id);
}

/** Hosts the agent may visit: the product's own hosts plus globally allowed (staging) hosts. */
export function urlPolicy(product: Product): UrlPolicy {
  return {
    allowedHosts: [...product.allowedHosts, ...config.allowedHosts],
    blockedUrlPatterns: product.blockedUrlPatterns,
  };
}
