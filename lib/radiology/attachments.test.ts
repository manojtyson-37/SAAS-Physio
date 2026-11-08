import { describe, expect, it } from "vitest";
import { safeFilename, sniffType } from "./attachments";

const bytes = (...n: number[]) => new Uint8Array([...n, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("attachment type sniffing", () => {
  it("recognises JPEG, PNG, WebP and PDF by their bytes", () => {
    expect(sniffType(bytes(0xff, 0xd8, 0xff))?.contentType).toBe("image/jpeg");
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47))?.ext).toBe("png");
    expect(sniffType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))?.contentType).toBe("image/webp");
    expect(sniffType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))?.contentType).toBe("application/pdf");
  });
  it("rejects everything else, whatever the file is called", () => {
    expect(sniffType(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffType(new TextEncoder().encode("MZ executable"))).toBeNull();
    expect(sniffType(new Uint8Array([]))).toBeNull();
  });
  it("cleans display file names", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\scans\\knee<1>.jpg")).toBe("knee1.jpg");
    expect(safeFilename("   ")).toBe("file");
    expect(safeFilename("a".repeat(300)).length).toBe(120);
  });
});
