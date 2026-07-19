// home-renderer.js
// Danh sách bài học (trang chủ): dựng danh sách các unit từ data/lessons/index.json
// và cho phép người học chọn một bài để mở (index.html?lesson=<id>).

import { t } from "./i18n.js";
import { renderVocabularyWidget } from "./vocabulary/vocab-home-widget.js";

function createElement(tag, options = {}, children = []) {
  const element = document.createElement(tag);

  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => element.setAttribute(key, value));
  }

  children.forEach((child) => {
    if (child) element.appendChild(child);
  });

  return element;
}

function renderStatusBadge(status) {
  const isAvailable = status === "available";
  const key = isAvailable ? "status.available" : "status.comingSoon";
  const modifier = isAvailable ? "available" : "pending";
  return createElement("span", { className: `status-badge status-badge--${modifier}`, text: t(key) });
}

function renderLessonCard(lesson) {
  const card = createElement("li", { className: "lesson-card" });

  const meta = createElement("div", { className: "lesson-card-meta" });
  meta.appendChild(
    createElement("span", { className: "lesson-unit-badge", text: `${t("lesson.unit")} ${lesson.unitNumber}` })
  );
  meta.appendChild(
    createElement("span", { className: "lesson-category", text: t(`lesson.${lesson.category.toLowerCase()}`) })
  );
  card.appendChild(meta);

  card.appendChild(createElement("h2", { className: "lesson-card-title", text: lesson.title }));

  if (lesson.description) {
    card.appendChild(createElement("p", { className: "lesson-card-description", text: lesson.description }));
  }

  const footer = createElement("div", { className: "lesson-card-footer" });
  footer.appendChild(renderStatusBadge(lesson.status));

  if (lesson.status === "available") {
    footer.appendChild(
      createElement("a", {
        className: "lesson-card-link",
        text: t("home.startLesson"),
        attrs: { href: `./index.html?lesson=${lesson.id}` }
      })
    );
  }

  card.appendChild(footer);
  return card;
}

/**
 * Dựng toàn bộ trang chủ vào #lesson-list. Có thể gọi lại (ví dụ sau khi đổi ngôn ngữ)
 * miễn là truyền lại cùng dữ liệu `lessonIndex` đã tải trước đó.
 */
function renderHome(lessonIndex) {
  const container = document.getElementById("lesson-list");
  if (!container) return;

  container.innerHTML = "";

  const header = createElement("div", { className: "lesson-list-header" });
  header.appendChild(createElement("h1", { className: "lesson-list-title", text: t("home.title") }));
  header.appendChild(createElement("p", { className: "lesson-list-subtitle", text: t("home.subtitle") }));
  container.appendChild(header);

  const list = createElement("ul", { className: "lesson-card-list" });
  (lessonIndex.lessons || []).forEach((lesson) => list.appendChild(renderLessonCard(lesson)));
  container.appendChild(list);

  const vocabularyWidgetContainer = createElement("div", { className: "vocab-widget-section" });
  container.appendChild(vocabularyWidgetContainer);
  renderVocabularyWidget(vocabularyWidgetContainer, lessonIndex).catch((error) =>
    console.error("[home-renderer] failed to render vocabulary widget:", error)
  );
}

export { renderHome };
