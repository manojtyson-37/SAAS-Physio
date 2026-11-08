import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { RAD_WORK_ROLES, radGate } from "@/lib/radiology/gate";
import { MAX_ATTACHMENTS_PER_ORDER, MAX_ATTACHMENT_BYTES, safeFilename, sniffType } from "@/lib/radiology/attachments";
import { storeDel, storePut } from "@/lib/storage/files";

type Ctx = { params: Promise<{ id: string }> };

const view = (a: { id: string; filename: string; contentType: string; sizeBytes: number; createdAt: Date; uploadedById: string | null }) => ({
  id: a.id, filename: a.filename, contentType: a.contentType, sizeBytes: a.sizeBytes, at: a.createdAt,
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await radGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const order = await prisma.imagingOrder.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null }, select: { id: true } });
  if (!order) return NextResponse.json({ error: "Imaging order not found" }, { status: 404 });
  const rows = await prisma.imagingAttachment.findMany({ where: { orderId: id, tenantId: g.tenantId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ attachments: rows.map(view) });
}

// Upload one file (JPEG, PNG, WebP or PDF, up to 4 MB). Every clinic role may attach (the radiographer is usually front desk).
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await radGate(RAD_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_ATTACHMENT_BYTES + 64 * 1024) return NextResponse.json({ error: "File is too large (4 MB maximum)" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) return NextResponse.json({ error: "File is too large (4 MB maximum)" }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) return NextResponse.json({ error: "Only JPEG, PNG, WebP or PDF files can be attached" }, { status: 415 });

  let blobPath: string | null = null;
  try {
    blobPath = `imaging/${g.tenantId}/${id}/${randomUUID()}.${type.ext}`;
    await storePut(blobPath, bytes, type.contentType);
    const row = await prisma.$transaction(async (tx) => {
      // Lock the order: the file count, the cancelled check and the insert happen as one step per order.
      const o = await tx.$queryRaw<{ status: string }[]>`SELECT status::text AS status FROM "ImagingOrder" WHERE id = ${id} AND "tenantId" = ${g.tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (o.length === 0) throw new HttpError(404, "Imaging order not found");
      if (o[0].status === "CANCELLED") throw new HttpError(409, "This order is cancelled");
      const count = await tx.imagingAttachment.count({ where: { orderId: id, tenantId: g.tenantId, deletedAt: null } });
      if (count >= MAX_ATTACHMENTS_PER_ORDER) throw new HttpError(409, `An order can hold at most ${MAX_ATTACHMENTS_PER_ORDER} files`);
      const created = await tx.imagingAttachment.create({
        data: { tenantId: g.tenantId, orderId: id, blobPath: blobPath!, filename: safeFilename(file.name), contentType: type.contentType, sizeBytes: bytes.length, uploadedById: g.session.userId },
      });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "ImagingAttachment", entityId: created.id } });
      return created;
    });
    return NextResponse.json({ attachment: view(row) }, { status: 201 });
  } catch (e) {
    // The row was not saved: do not leave an orphan file behind.
    if (blobPath) await storeDel(blobPath).catch(() => {});
    return toErrorResponse(e);
  }
}
