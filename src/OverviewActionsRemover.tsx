import { useEffect } from "react";

const ACTIONS_TITLE = "งานที่ต้องดำเนินการ";

const cleanOverviewActions = () => {
  const heading = Array.from(document.querySelectorAll("h3")).find(
    (element) => element.textContent?.trim() === ACTIONS_TITLE
  );
  if (!heading) return;

  const article = heading.closest("article");
  const sideColumn = article?.parentElement;
  const overviewGrid = sideColumn?.parentElement;

  if (sideColumn) {
    sideColumn.remove();
  }

  if (overviewGrid instanceof HTMLElement) {
    overviewGrid.classList.remove(
      "xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]"
    );
    overviewGrid.classList.add("grid-cols-1");
  }
};

export default function OverviewActionsRemover(): null {
  useEffect(() => {
    cleanOverviewActions();

    const observer = new MutationObserver(cleanOverviewActions);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
