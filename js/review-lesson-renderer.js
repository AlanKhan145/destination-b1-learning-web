// review-lesson-renderer.js
// Renders a "Review"-category lesson (a cumulative test with no lesson
// content of its own, e.g. review-1). Its own self-contained header (no
// topic list — there's no lesson content to list, unlike Grammar/Vocabulary
// pages) plus a test-overview table instead of the topic-status list that
// makes sense for an actual lesson. Table markup reuses the existing
// .data-table component (same one lesson-renderer.js uses for forms/uses
// tables) so it inherits the same responsive card-stacking on mobile.
import { t } from "./i18n.js";
import { createElement } from "./utils.js";
import { renderLessonNavigation } from "./lesson-renderer.js";

function renderReviewHeader(lesson) {
  const container = createElement("div", { className: "lesson-header-content review-lesson-header-content" });

  container.appendChild(
    createElement("a", {
      className: "back-to-lessons-link",
      text: t("navigation.backToLessons"),
      attrs: { href: "./index.html" }
    })
  );

  const meta = createElement("div", { className: "lesson-meta" });
  meta.appendChild(createElement("span", { className: "lesson-unit-badge", text: `${t("lesson.unit")} ${lesson.unitNumber}` }));
  meta.appendChild(createElement("span", { className: "lesson-category", text: t(`lesson.${lesson.category.toLowerCase()}`) }));
  container.appendChild(meta);

  container.appendChild(createElement("h1", { className: "lesson-title", text: lesson.title }));

  if (lesson.description) {
    container.appendChild(createElement("p", { className: "lesson-description", text: lesson.description }));
  }

  return container;
}

function renderOverviewTable(topics) {
  const wrapper = createElement("div", { className: "table-wrapper" });
  const table = createElement("table", { className: "data-table review-overview-table" });

  const thead = createElement("thead");
  const headerRow = createElement("tr");
  headerRow.appendChild(createElement("th", { text: t("lesson.testPart"), attrs: { scope: "col" } }));
  headerRow.appendChild(createElement("th", { text: t("lesson.testFormat"), attrs: { scope: "col" } }));
  headerRow.appendChild(createElement("th", { text: t("lesson.testItems"), attrs: { scope: "col" } }));
  thead.appendChild(headerRow);

  const tbody = createElement("tbody");
  topics.forEach((topic) => {
    const tr = createElement("tr");
    tr.appendChild(createElement("th", { text: `${topic.number}. ${topic.title}`, attrs: { scope: "row" } }));
    tr.appendChild(createElement("td", { text: topic.format || "", attrs: { "data-label": t("lesson.testFormat") } }));
    tr.appendChild(
      createElement("td", {
        className: "review-overview-count",
        text: topic.itemCount ? `${topic.itemCount} ${topic.itemLabel || ""}`.trim() : "",
        attrs: { "data-label": t("lesson.testItems") }
      })
    );
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function renderReviewLesson(lesson) {
  const headerContainer = document.getElementById("lesson-header");
  const tocContainer = document.getElementById("table-of-contents");
  const contentContainer = document.getElementById("lesson-content");
  const paginationContainer = document.getElementById("lesson-pagination");
  const lessonPane = document.getElementById("lesson-pane");
  const reviewPanel = document.getElementById("review-panel");

  if (!headerContainer || !tocContainer || !contentContainer || !paginationContainer) {
    console.error("Không tìm thấy vùng giao diện bài học trong DOM.");
    return;
  }

  // A test's whole point is the review itself, not a lesson with a review
  // sidebar bolted on — stack the intro above a full-width review panel
  // instead of the usual narrow-aside two-column layout (see .workspace--review-mode).
  document.getElementById("workspace")?.classList.add("workspace--review-mode");

  headerContainer.innerHTML = "";
  headerContainer.appendChild(renderReviewHeader(lesson));

  // No table of contents — there's no lesson content to scroll-spy to.
  // Hide the container itself, not just its contents: .table-of-contents has
  // its own padding/border/shadow that would otherwise show as an empty bar.
  tocContainer.innerHTML = "";
  tocContainer.hidden = true;

  contentContainer.innerHTML = "";
  const topics = lesson.topics || [];
  const totalItems = topics.reduce((sum, topic) => sum + (topic.itemCount || 0), 0);

  contentContainer.appendChild(createElement("h2", { className: "subsection-title", text: t("lesson.testOverviewTitle") }));
  contentContainer.appendChild(
    createElement("p", {
      className: "topics-intro",
      text: t("lesson.testOverviewIntro", { partCount: topics.length, totalItems })
    })
  );
  contentContainer.appendChild(renderOverviewTable(topics));
  contentContainer.appendChild(createElement("p", { className: "review-overview-cta", text: t("lesson.testOverviewCta") }));

  paginationContainer.innerHTML = "";
  paginationContainer.setAttribute("aria-label", t("navigation.paginationLabel"));
  paginationContainer.appendChild(renderLessonNavigation(lesson));

  // Keep the test before previous/next lesson navigation. The review panel is
  // a workspace sibling in the generic lesson shell, so move it into this
  // standalone page's flow immediately before pagination.
  if (lessonPane && reviewPanel) {
    lessonPane.insertBefore(reviewPanel, paginationContainer);
  }
}

export { renderReviewLesson };
