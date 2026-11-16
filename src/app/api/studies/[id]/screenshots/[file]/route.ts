import fs from "fs/promises";
import path from "path";
import { screenshotsDir } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-zA-Z0-9_-]+\.jpg$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(path.join(screenshotsDir(id), file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
