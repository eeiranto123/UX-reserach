import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import type { Study } from "./types";

/**
 * File-based storage for the MVP: data/studies/<id>/study.json plus a
 * screenshots folder. The interface is small on purpose so it can be swapped
 * for Postgres + object storage (S3/GCS) when this runs as a shared service.
 */

const studiesDir = () => path.join(config.dataDir, "studies");
const ID_RE = /^[a-zA-Z0-9_-]+$/;

export function studyDir(id: string): string {
  if (!ID_RE.test(id)) throw new Error("invalid study id");
  return path.join(studiesDir(), id);
}

export function screenshotsDir(id: string): string {
  return path.join(studyDir(id), "screenshots");
}

// Serialise writes per study so concurrent sessions don't clobber each other.
const locks = new Map<string, Promise<unknown>>();

export async function saveStudy(study: Study): Promise<void> {
  const dir = studyDir(study.id);
  await fs.mkdir(path.join(dir, "screenshots"), { recursive: true });
  const file = path.join(dir, "study.json");
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(study, null, 2));
  await fs.rename(tmp, file);
}

export async function loadStudy(id: string): Promise<Study | undefined> {
  try {
    return JSON.parse(await fs.readFile(path.join(studyDir(id), "study.json"), "utf8"));
  } catch {
    return undefined;
  }
}

/** Load, mutate and save a study under a per-study lock. */
export async function updateStudy(id: string, mutate: (s: Study) => void): Promise<Study> {
  const prev = locks.get(id) ?? Promise.resolve();
  const next = prev.then(async () => {
    const study = await loadStudy(id);
    if (!study) throw new Error(`study ${id} not found`);
    mutate(study);
    await saveStudy(study);
    return study;
  });
  locks.set(id, next.catch(() => undefined));
  return next;
}

export async function listStudies(): Promise<Study[]> {
  let ids: string[] = [];
  try {
    ids = await fs.readdir(studiesDir());
  } catch {
    return [];
  }
  const studies = await Promise.all(ids.filter((i) => ID_RE.test(i)).map(loadStudy));
  return studies
    .filter((s): s is Study => Boolean(s))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
