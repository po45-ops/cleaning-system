import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PublicDashboard from "./PublicDashboard";

const getTodayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

describe("PublicDashboard", () => {
  it("uses the latest record per day and zone, shows the latest note, and hides evidence images", () => {
    const today = getTodayKey();
    const html = renderToStaticMarkup(
      <PublicDashboard
        inspections={[
          {
            id: 100,
            date: today,
            zoneId: 1,
            score: 3,
            status: "approved",
            notes: "OLD_NOTE",
            images: ["data:image/jpeg;base64,OLD_PRIVATE_IMAGE"],
          },
          {
            id: 200,
            date: today,
            zoneId: 1,
            score: 0,
            status: "rejected",
            notes: "NEW_NOTE",
            images: ["data:image/jpeg;base64,NEW_PRIVATE_IMAGE"],
          },
        ]}
        zones={[
          { id: 1, name: "เขต 1", class: "ป.1" },
          { id: 2, name: "เขต 2", class: "ป.2" },
        ]}
        isLoading={false}
        error=""
        lastUpdated={new Date("2026-08-26T08:30:00+07:00")}
        onRefresh={() => undefined}
      />
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("1/2 เขต");
    expect(text).toContain("ไม่ผ่าน");
    expect(text).toContain("0/3");
    expect(text).not.toContain("3/3");
    expect(text).toContain("NEW_NOTE");
    expect(text).not.toContain("OLD_NOTE");
    expect(html).not.toContain("PRIVATE_IMAGE");
  });
});
