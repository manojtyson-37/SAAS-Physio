/** Rules for files attached to imaging orders. The type is decided from the file's own bytes, never from the browser's claim. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // Vercel functions accept request bodies up to 4.5 MB
export const MAX_ATTACHMENTS_PER_ORDER = 20;

export type SniffedType = { contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; ext: "jpg" | "png" | "webp" | "pdf" };

export function sniffType(b: Uint8Array): SniffedType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { contentType: "image/png", ext: "png" };
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { contentType: "image/webp", ext: "webp" };
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { contentType: "application/pdf", ext: "pdf" };
  return null;
}

/** Display name only (never used as a storage path): strips path parts and control characters, keeps it short. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f"<>|:*?]/g, "").trim().slice(0, 120);
  return cleaned || "file";
}
