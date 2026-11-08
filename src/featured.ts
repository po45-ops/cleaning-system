export const SYSTEM_SITE_URL = "https://po45-ops.github.io/cleaning-system/";

export type FeaturedCandidate = { zone: number; score: number; date: string };

/**
 * จัดอันดับรายการรูปที่ "เด่น" ของสัปดาห์: รอบแรกเลือกรายการคะแนนสูงสุดของแต่ละเขต (กระจายให้ครบทุกเขต)
 * รอบถัดไปเติมด้วยรายการคะแนนสูงรองลงมา คะแนนเท่ากันเลือกวันที่เก่ากว่าก่อน
 * คืนค่าเป็นลำดับดัชนี เรียงจากเด่นที่สุดไปน้อยที่สุด
 */
export function rankFeatured(items: FeaturedCandidate[]): number[] {
  const byScore = items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        Number(b.item.score) - Number(a.item.score) ||
        String(a.item.date).localeCompare(String(b.item.date)) ||
        a.index - b.index
    );
  const seenZones = new Set<number>();
  const firstRound: number[] = [];
  const rest: number[] = [];
  byScore.forEach(({ item, index }) => {
    if (!seenZones.has(item.zone)) {
      seenZones.add(item.zone);
      firstRound.push(index);
    } else {
      rest.push(index);
    }
  });
  return [...firstRound, ...rest];
}
