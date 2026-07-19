// vocab-home-widget.js
// Home-page "Vocabulary Review" section. Called once from home-renderer.js
// with the already-fetched lessons index — no review logic lives in
// home-renderer.js itself, it's all here and in vocabulary-review-ui.js.

import { t } from "../i18n.js";
import { createElement } from "../utils.js";
import { loadVocabularySet, getFlatEntries } from "./vocabulary-data.js";
import { getStats } from "./vocabulary-progress.js";
import { openVocabularyQuickReview } from "./vocabulary-review-ui.js";

function renderWidgetCard(lesson, stats) {
  const card = createElement("li", { className: "vocab-widget-card" });

  const meta = createElement("div", { className: "lesson-card-meta" });
  meta.appendChild(createElement("span", { className: "lesson-unit-badge", text: `${t("lesson.unit")} ${lesson.unitNumber}` }));
  meta.appendChild(createElement("span", { className: "lesson-category", text: t(`lesson.${lesson.category.toLowerCase()}`) }));
  card.appendChild(meta);

  card.appendChild(createElement("h3", { className: "vocab-widget-title", text: lesson.title }));

  const countsList = createElement("ul", { className: "vocab-widget-counts" });
  countsList.appendChild(createElement("li", { text: t("vocabulary.home.wordsCount", { count: stats.total }) }));
  countsList.appendChild(createElement("li", { className: "vocab-widget-count--mastered", text: t("vocabulary.home.masteredCount", { count: stats.mastered }) }));
  countsList.appendChild(createElement("li", { className: "vocab-widget-count--needs-review", text: t("vocabulary.home.needsReviewCount", { count: stats.needsReview }) }));
  countsList.appendChild(createElement("li", { className: "vocab-widget-count--new", text: t("vocabulary.home.newCount", { count: stats.new }) }));
  card.appendChild(countsList);

  const track = createElement("div", { className: "vocab-progress-track vocab-widget-progress-track" });
  const fill = createElement("div", { className: "vocab-progress-fill" });
  fill.style.width = `${stats.completionRate}%`;
  track.appendChild(fill);
  card.appendChild(track);

  const actions = createElement("div", { className: "vocab-widget-actions" });

  const quickReviewButton = createElement("button", {
    className: "review-primary-button",
    text: t("vocabulary.home.quickReview"),
    attrs: { type: "button" }
  });
  quickReviewButton.addEventListener("click", () => openVocabularyQuickReview(lesson.id));
  actions.appendChild(quickReviewButton);

  actions.appendChild(
    createElement("a", {
      className: "review-secondary-button vocab-widget-link",
      text: t("vocabulary.home.viewWordList"),
      attrs: { href: `./index.html?lesson=${lesson.id}` }
    })
  );

  card.appendChild(actions);
  return card;
}

/**
 * Renders the Home "Vocabulary Review" section into `container` for every
 * lesson in `lessonIndex.lessons` flagged `vocabularyReview: true`. Not
 * unit-3-specific — a future Unit 4 just needs the same flag on its index entry.
 */
async function renderVocabularyWidget(container, lessonIndex) {
  const vocabularyLessons = (lessonIndex.lessons || []).filter((lesson) => lesson.vocabularyReview);
  if (!vocabularyLessons.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = "";
  container.appendChild(createElement("h2", { className: "vocab-widget-heading", text: t("vocabulary.home.widgetTitle") }));

  const list = createElement("ul", { className: "vocab-widget-list" });
  container.appendChild(list);

  const cards = await Promise.all(
    vocabularyLessons.map(async (lesson) => {
      try {
        const vocabularySet = await loadVocabularySet(lesson.id);
        const flatEntries = getFlatEntries(vocabularySet);
        const stats = getStats(lesson.id, flatEntries.length);
        return renderWidgetCard(lesson, stats);
      } catch (error) {
        console.error(`[vocab-home-widget] failed to load vocabulary set for "${lesson.id}":`, error);
        return null;
      }
    })
  );

  cards.filter(Boolean).forEach((card) => list.appendChild(card));
}

export { renderVocabularyWidget };
