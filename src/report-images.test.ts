import { describe, expect, it } from "vitest";
import { dataUrlToBytes, loadReportImage, MISSING_IMAGE_PLACEHOLDER } from "./report-images";

describe("report-images", () => {
  it("decodes data URLs to bytes", () => {
    const bytes = dataUrlToBytes("data:text/plain;base64,QUJD");
    expect(Array.from(bytes)).toEqual([65, 66, 67]);
  });

  it("uses an inline placeholder that needs no external site", () => {
    expect(MISSING_IMAGE_PLACEHOLDER.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(MISSING_IMAGE_PLACEHOLDER)).toContain("ไม่มีรูปภาพ");
  });

  it("returns null for an empty source instead of throwing", async () => {
    await expect(loadReportImage("")).resolves.toBeNull();
  });
});
