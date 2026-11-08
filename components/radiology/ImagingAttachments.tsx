"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { useIsAdmin } from "@/components/ClinicContext";
import { api, btnPrimary, Notice, type Msg } from "@/components/pharmacy/ui";

type Att = { id: string; filename: string; contentType: string; sizeBytes: number; at: string };
const LIMIT = 4 * 1024 * 1024;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Shrinks a large photo or scan to fit the 4 MB upload limit (longest side 2400 px, JPEG). PDFs and small files go as they are. */
async function fit(file: File): Promise<File> {
  if (file.size <= LIMIT * 0.9 || !file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (const q of [0.88, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= LIMIT * 0.95) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  }
  return file;
}

export default function ImagingAttachments({ orderId, canUpload }: { orderId: string; canUpload: boolean }) {
  const isAdmin = useIsAdmin();
  const [files, setFiles] = useState<Att[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/radiology/orders/${orderId}/attachments`;

  const load = useCallback(async () => {
    const r = await api<{ attachments: Att[] }>(base);
    if (r.ok) setFiles(r.data.attachments); else setMsg({ ok: false, text: r.error });
  }, [base]);
  useEffect(() => {
    api<{ attachments: Att[] }>(base).then((r) => { if (r.ok) setFiles(r.data.attachments); else setMsg({ ok: false, text: r.error }); });
  }, [base]);

  async function upload(picked: FileList | null) {
    if (!picked?.length) return;
    setBusy(true);
    setMsg(null);
    let done = 0;
    for (const original of Array.from(picked)) {
      const file = await fit(original);
      if (file.size > LIMIT) { setMsg({ ok: false, text: `${original.name} is larger than 4 MB. Reduce it and try again` }); continue; }
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(base, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: (data as { error?: string }).error ?? "Upload failed" }); continue; }
      done++;
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (done) setMsg({ ok: true, text: `${done} file${done === 1 ? "" : "s"} attached` });
    await load();
  }

  async function revoke(a: Att) {
    if (!window.confirm(`Remove "${a.filename}" from this order? It is hidden, and kept in the audit trail.`)) return;
    const r = await api(`${base}/${a.id}`, "DELETE");
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "File removed" });
    await load();
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">Images and files</h2>
        {canUpload && (
          <>
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => void upload(e.target.files)} aria-label="Attach files" />
            <button disabled={busy} onClick={() => input.current?.click()} className={btnPrimary}>{busy ? "Uploading…" : "Attach files"}</button>
          </>
        )}
      </div>
      <Notice msg={msg} />
      {files && files.length === 0 && <p className="text-sm text-ink/50">No images or outside reports attached. JPEG, PNG, WebP or PDF; large photos are shrunk automatically.</p>}
      {files && files.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-xl border border-sand">
              <a href={`${base}/${a.id}/file`} target="_blank" rel="noreferrer" className="block bg-sand/40">
                {a.contentType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${base}/${a.id}/file`} alt={a.filename} className="h-40 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-40 items-center justify-center font-data text-sm text-ink/50">PDF</div>
                )}
              </a>
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="min-w-0 truncate" title={a.filename}>{a.filename} <span className="text-ink/40">{kb(a.sizeBytes)}</span></span>
                <span className="flex shrink-0 gap-3">
                  <a href={`${base}/${a.id}/file?download=1`} className="text-forest hover:underline">Download</a>
                  {isAdmin && <button onClick={() => void revoke(a)} className="text-clay hover:underline">Remove</button>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
