/**
 * Storage adapter.
 *
 * Every image the app reads or writes goes through this module — nothing else
 * touches the filesystem. That's deliberate: moving to S3 / Cloudflare R2 later
 * means writing one more driver here and flipping STORAGE_DRIVER, with no
 * changes anywhere else in the codebase.
 *
 * Keys look like:
 *    outputs/<pid>/<filename>     generated shoot images + the garment reference
 *    models/<mid>/<filename>      a saved model's reference images
 *    garments/<gid>/<filename>    a saved garment's tagged reference images
 *
 * Those key paths are also the public URL paths (`/outputs/...`, `/models/...`),
 * which keeps every URL already stored in migrated log rows working unchanged.
 */
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, STORAGE_DRIVER } from './config';

export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  /** Delete an entire folder, e.g. every image in one shoot. */
  removePrefix(prefix: string): Promise<void>;
  /** Byte length, or null when the object doesn't exist. */
  size(key: string): Promise<number | null>;
}

/**
 * Reject anything that could climb out of the data directory. Filenames reach
 * this layer from URL segments and from records written long ago on a different
 * OS, so this is enforced centrally rather than trusted at each call site.
 */
function assertSafeKey(key: string): string {
  const clean = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.includes('..') || clean.includes('\0')) {
    throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
  }
  return clean;
}

class LocalDriver implements StorageDriver {
  private root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, assertSafeKey(key));
    // Belt-and-braces: even with the key check above, confirm the resolved path
    // is genuinely inside the data root before any I/O happens.
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new Error(`Storage key escapes data dir: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      // Already gone is a success as far as callers are concerned.
    }
  }

  async removePrefix(prefix: string): Promise<void> {
    try {
      await fs.rm(this.resolve(prefix), { recursive: true, force: true });
    } catch {
      // ditto
    }
  }

  async size(key: string): Promise<number | null> {
    try {
      const st = await fs.stat(this.resolve(key));
      return st.size;
    } catch {
      return null;
    }
  }
}

function makeDriver(): StorageDriver {
  switch (STORAGE_DRIVER) {
    case 'local':
      return new LocalDriver(DATA_DIR);
    // Add an 's3' / 'r2' case here to move off local disk. Implement the same
    // six methods against the SDK and nothing else in the app needs to change.
    default:
      throw new Error(
        `Unknown STORAGE_DRIVER "${STORAGE_DRIVER}". Supported: "local".`,
      );
  }
}

export const storage: StorageDriver = makeDriver();

// ── key + URL helpers ───────────────────────────────────────────────

/** Strip any directory part, however the path was originally separated. */
export function baseName(p: string): string {
  return String(p).replace(/\\/g, '/').split('/').pop() ?? '';
}

export const shootKey = (pid: string, file: string) =>
  `outputs/${pid}/${baseName(file)}`;

export const shootPrefix = (pid: string) => `outputs/${pid}`;

export const modelKey = (mid: string, file: string) =>
  `models/${mid}/${baseName(file)}`;

export const modelPrefix = (mid: string) => `models/${mid}`;

export const garmentKey = (gid: string, file: string) =>
  `garments/${gid}/${baseName(file)}`;

export const garmentPrefix = (gid: string) => `garments/${gid}`;

/** Public, browser-facing URL for a storage key. */
export const publicUrl = (key: string) => `/${key}`;

export const shootUrl = (pid: string, file: string) =>
  publicUrl(shootKey(pid, file));

export const modelUrl = (mid: string, file: string) =>
  publicUrl(modelKey(mid, file));

export const garmentUrl = (gid: string, file: string) =>
  publicUrl(garmentKey(gid, file));