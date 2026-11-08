import { promises as fs } from "node:fs";
import path from "node:path";
import { put, get, del } from "@vercel/blob";

/**
 * Private file storage. In production files go to the clinic's PRIVATE Vercel Blob store (token from
 * BLOB_READ_WRITE_TOKEN); they have no public URL and are only served through our authenticated routes.
 * Without a token (local development) files are written under ./.uploads (gitignored).
 */
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const localPath = (p: string) => {
  const full = path.join(process.cwd(), ".uploads", p);
  if (!full.startsWith(path.join(process.cwd(), ".uploads") + path.sep)) throw new Error("Invalid path");
  return full;
};

export async function storePut(pathname: string, data: Buffer, contentType: string): Promise<void> {
  if (hasBlob()) {
    await put(pathname, data, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
    return;
  }
  const full = localPath(pathname);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function storeGet(pathname: string): Promise<{ stream: ReadableStream<Uint8Array> } | null> {
  if (hasBlob()) {
    const r = await get(pathname, { access: "private" });
    if (!r || !r.stream) return null;
    return { stream: r.stream as ReadableStream<Uint8Array> };
  }
  try {
    const buf = await fs.readFile(localPath(pathname));
    return { stream: new Response(new Uint8Array(buf)).body as ReadableStream<Uint8Array> };
  } catch {
    return null;
  }
}

export async function storeDel(pathname: string): Promise<void> {
  if (hasBlob()) {
    await del(pathname);
    return;
  }
  await fs.rm(localPath(pathname), { force: true });
}
