-- CreateTable
CREATE TABLE "ImagingAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ImagingAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImagingAttachment_orderId_idx" ON "ImagingAttachment"("orderId");

-- CreateIndex
CREATE INDEX "ImagingAttachment_tenantId_idx" ON "ImagingAttachment"("tenantId");

-- AddForeignKey
ALTER TABLE "ImagingAttachment" ADD CONSTRAINT "ImagingAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ImagingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
