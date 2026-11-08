import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { radGate } from "@/lib/radiology/gate";
import { storeGet } from "@/lib/storage/files";

/** Streams the file to a signed-in user of the same clinic. Never cached, never sniffed. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; attId: string }> }) {
  const g = await radGate();
  if (!g.session) return g.response;
  const { id, attId } = await params;
  const a = await prisma.imagingAttachment.findFirst({ where: { id: attId, orderId: id, tenantId: g.tenantId, deletedAt: null, order: { deletedAt: null } } });
  if (!a) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const obj = await storeGet(a.blobPath);
  if (!obj) return NextResponse.json({ error: "File not found" }, { status: 404 });
  // Images may show inline; anything else (PDF) is always a download so embedded content never runs on our origin.
  const download = req.nextUrl.searchParams.get("download") === "1" || !a.contentType.startsWith("image/");
  const asciiName = a.filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new NextResponse(obj.stream, {
    headers: {
      "Content-Type": a.contentType,
      "Content-Length": String(a.sizeBytes),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
