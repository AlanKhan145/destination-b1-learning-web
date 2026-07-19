// vocabulary-lesson-renderer.js
// Renders a Vocabulary-category lesson (data/vocabulary/{unitId}.json) into the
// same #lesson-header/#table-of-contents/#lesson-content/#lesson-pagination
// containers lesson-renderer.js uses for Grammar lessons. Not unit-3-specific —
// takes whatever lesson/vocabularySet it's given.
//
// The toolbar (search/status/part-of-speech) and the card grid are kept as
// separate DOM regions: only the grid is torn down and rebuilt when a filter
// changes, so the search input never loses focus/cursor position mid-typing.

import { t } from "../i18n.js";
import { createElement } from "../utils.js";
import { renderLessonNavigation, highlightWords } from "../lesson-renderer.js";
import { SECTION_META, getFlatEntries } from "./vocabulary-data.js";
import { loadProgress, getEntryProgress, setStatus, getStats } from "./vocabulary-progress.js";
import { speak, isSpeechSupported } from "./pronounce.js";
import { openVocabularyQuickReview } from "./vocabulary-review-ui.js";

const PLACEHOLDER_IMAGE = "./assets/vocabulary/placeholder.svg";
const STATUS_KEYS = ["new", "learning", "needs-review", "mastered"];

// Module state for the currently-rendered vocabulary lesson. Re-populated
// each time renderVocabularyLesson() is called (i.e. on navigation).
const state = {
  lesson: null,
  vocabularySet: null,
  flatEntries: [],
  filters: { query: "", status: "all", partOfSpeech: "all" },
  sectionsContainer: null,
  progressBarFill: null,
  progressBarLabel: null
};

function renderVocabularyImage(entry) {
  const img = createElement("img", {
    className: "vocab-card-image",
    attrs: {
      src: entry.image || PLACEHOLDER_IMAGE,
      alt: entry.imageAlt || entry.displayText || "",
      loading: "lazy",
      width: "512",
      height: "512"
    }
  });
  img.addEventListener(
    "error",
    () => {
      img.src = PLACEHOLDER_IMAGE;
    },
    { once: true }
  );
  return img;
}

function renderExample(example) {
  if (!example) return null;
  const wrapper = createElement("div", { className: "vocab-example" });
  if (example.en) wrapper.appendChild(createElement("p", { className: "vocab-example-en", text: example.en }));
  if (example.vi) wrapper.appendChild(createElement("p", { className: "vocab-example-vi", text: example.vi }));
  return wrapper;
}

function renderPartOfSpeech(partOfSpeech) {
  if (!partOfSpeech) return null;
  const text = Array.isArray(partOfSpeech) ? partOfSpeech.join(", ") : partOfSpeech;
  return createElement("span", { className: "vocab-pos", text });
}

function statusModifier(status) {
  return status.replace(/\s+/g, "-");
}

function renderStatusBadge(status) {
  return createElement("span", {
    className: `status-badge vocab-status-badge status-badge--${statusModifier(status)}`,
    text: t(`vocabulary.status.${toCamelCase(status)}`)
  });
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Listen / mark-known / mark-review row, shared by every card type. */
function renderCardActions(entry, progressEntry) {
  const actions = createElement("div", { className: "vocab-card-actions" });

  if (isSpeechSupported()) {
    const listenButton = createElement("button", {
      className: "vocab-action-button vocab-action-listen",
      text: t("vocabulary.card.listen"),
      attrs: { type: "button" }
    });
    listenButton.addEventListener("click", () => speak(entry.displayText));
    actions.appendChild(listenButton);
  }

  const knownButton = createElement("button", {
    className: "vocab-action-button vocab-action-known",
    text: t("vocabulary.card.markKnown"),
    attrs: { type: "button" }
  });
  knownButton.addEventListener("click", () => {
    setStatus(state.lesson.id, entry.id, "mastered");
    renderFilteredSections();
  });
  actions.appendChild(knownButton);

  const reviewButton = createElement("button", {
    className: "vocab-action-button vocab-action-review",
    text: t("vocabulary.card.markReview"),
    attrs: { type: "button" }
  });
  reviewButton.addEventListener("click", () => {
    setStatus(state.lesson.id, entry.id, "needs-review");
    renderFilteredSections();
  });
  actions.appendChild(reviewButton);

  const footer = createElement("div", { className: "vocab-card-footer" });
  footer.appendChild(renderStatusBadge(progressEntry.status));
  footer.appendChild(actions);
  return footer;
}

/** Card for a "word" / "phrasal-verb" / "prepositional-phrase" entry. */
function renderWordCard(entry, progressEntry) {
  const card = createElement("li", { className: "vocab-card", attrs: { "data-vocab-id": entry.id } });
  card.appendChild(renderVocabularyImage(entry));

  const body = createElement("div", { className: "vocab-card-body" });
  body.appendChild(createElement("p", { className: "vocab-word", text: entry.displayText }));

  const meta = createElement("div", { className: "vocab-card-meta" });
  if (entry.phonetic) meta.appendChild(createElement("span", { className: "vocab-phonetic", text: entry.phonetic }));
  const posEl = renderPartOfSpeech(entry.partOfSpeech);
  if (posEl) meta.appendChild(posEl);
  body.appendChild(meta);

  if (entry.meaningVi) body.appendChild(createElement("p", { className: "vocab-meaning-vi", text: entry.meaningVi }));
  if (entry.definitionEn) body.appendChild(createElement("p", { className: "vocab-definition", text: entry.definitionEn }));
  if (entry.usageEn) body.appendChild(createElement("p", { className: "vocab-definition", text: entry.usageEn }));

  const exampleEl = renderExample(entry.example);
  if (exampleEl) body.appendChild(exampleEl);

  body.appendChild(renderCardActions(entry, progressEntry));

  card.appendChild(body);
  return card;
}

/** Card for a "word-family" entry (root word + derived forms). */
function renderWordFamilyCard(entry, progressEntry) {
  const card = createElement("li", { className: "vocab-card vocab-card--family", attrs: { "data-vocab-id": entry.id } });
  card.appendChild(renderVocabularyImage(entry));

  const body = createElement("div", { className: "vocab-card-body" });
  body.appendChild(createElement("p", { className: "vocab-word", text: entry.root }));

  const formsList = createElement("ul", { className: "vocab-forms-list" });
  (entry.forms || []).forEach((form) => {
    const item = createElement("li", { className: "vocab-form-item" });
    item.appendChild(createElement("span", { className: "vocab-form-word", text: form.word }));
    if (form.partOfSpeech) item.appendChild(createElement("span", { className: "vocab-pos", text: form.partOfSpeech }));
    if (form.meaningVi) item.appendChild(createElement("span", { className: "vocab-form-meaning", text: form.meaningVi }));
    formsList.appendChild(item);
  });

  const details = createElement("details", { className: "vocab-forms-details" });
  const summary = createElement("summary", { className: "vocab-forms-summary", text: t("vocabulary.wordFormation.showForms") });
  details.addEventListener("toggle", () => {
    summary.textContent = t(details.open ? "vocabulary.wordFormation.hideForms" : "vocabulary.wordFormation.showForms");
  });
  details.append(summary, formsList);
  body.appendChild(details);

  body.appendChild(renderCardActions(entry, progressEntry));

  card.appendChild(body);
  return card;
}

/** Card for a "word-pattern" entry (adjective/verb/noun + preposition pattern). */
function renderWordPatternCard(entry, progressEntry) {
  const card = createElement("li", { className: "vocab-card vocab-card--pattern", attrs: { "data-vocab-id": entry.id } });
  card.appendChild(renderVocabularyImage(entry));

  const body = createElement("div", { className: "vocab-card-body" });
  if (entry.structure) {
    const structureEl = createElement("p", { className: "vocab-pattern-structure" });
    structureEl.appendChild(highlightWords(entry.structure, entry.prepositions || []));
    body.appendChild(structureEl);
  }
  if (entry.meaningVi) body.appendChild(createElement("p", { className: "vocab-meaning-vi", text: entry.meaningVi }));

  const exampleEl = renderExample(entry.example);
  if (exampleEl) body.appendChild(exampleEl);

  if (entry.commonMistake) {
    body.appendChild(
      createElement("p", {
        className: "vocab-common-mistake",
        text: `${t("vocabulary.wordPattern.commonMistakeLabel")}: ${entry.commonMistake}`
      })
    );
  }

  body.appendChild(renderCardActions(entry, progressEntry));

  card.appendChild(body);
  return card;
}

function renderCardForEntry(entry, progressEntry) {
  if (entry.type === "word-family") return renderWordFamilyCard(entry, progressEntry);
  if (entry.type === "word-pattern") return renderWordPatternCard(entry, progressEntry);
  return renderWordCard(entry, progressEntry);
}

function renderVocabularyHeader(lesson, vocabularySet) {
  const container = createElement("div", { className: "lesson-header-content" });

  container.appendChild(
    createElement("a", {
      className: "back-to-lessons-link",
      text: t("navigation.backToLessons"),
      attrs: { href: "./index.html" }
    })
  );

  const meta = createElement("div", { className: "lesson-meta" });
  meta.appendChild(
    createElement("span", { className: "lesson-unit-badge", text: `${t("lesson.unit")} ${lesson.unitNumber}` })
  );
  meta.appendChild(
    createElement("span", { className: "lesson-category", text: t(`lesson.${lesson.category.toLowerCase()}`) })
  );
  container.appendChild(meta);

  container.appendChild(createElement("h1", { className: "lesson-title", text: vocabularySet.title || lesson.title }));

  if (lesson.description) {
    container.appendChild(createElement("p", { className: "lesson-description", text: lesson.description }));
  }

  if (vocabularySet.sourceNote) {
    container.appendChild(createElement("p", { className: "vocab-source-note", text: vocabularySet.sourceNote }));
  }

  const quickReviewButton = createElement("button", {
    className: "review-primary-button vocab-quick-review-button",
    text: t("vocabulary.home.quickReview"),
    attrs: { type: "button" }
  });
  quickReviewButton.addEventListener("click", () => openVocabularyQuickReview(lesson.id));
  container.appendChild(quickReviewButton);

  return container;
}

function renderVocabularyToc(sectionsWithEntries) {
  const wrapper = createElement("div", { className: "toc-inner" });
  wrapper.appendChild(createElement("span", { className: "toc-label", text: t("lesson.tableOfContents") }));

  const list = createElement("ul", { className: "toc-list" });
  sectionsWithEntries.forEach(({ sectionId, titleKey }) => {
    const item = createElement("li", { className: "toc-item" });
    item.appendChild(
      createElement("a", {
        className: "toc-link",
        text: t(titleKey),
        attrs: { href: `#${sectionId}`, "data-topic-id": sectionId }
      })
    );
    list.appendChild(item);
  });

  wrapper.appendChild(list);
  return wrapper;
}

function collectPartsOfSpeech(flatEntries) {
  const seen = new Set();
  flatEntries.forEach((entry) => {
    if (Array.isArray(entry.partOfSpeech)) entry.partOfSpeech.forEach((pos) => seen.add(pos));
  });
  return Array.from(seen).sort();
}

function renderProgressBar() {
  const wrapper = createElement("div", { className: "vocab-progress" });
  const label = createElement("p", { className: "vocab-progress-label" });
  const track = createElement("div", { className: "vocab-progress-track" });
  const fill = createElement("div", { className: "vocab-progress-fill" });
  track.appendChild(fill);
  wrapper.append(label, track);

  state.progressBarLabel = label;
  state.progressBarFill = fill;
  return wrapper;
}

function updateProgressBar() {
  if (!state.progressBarLabel || !state.progressBarFill) return;
  const stats = getStats(state.lesson.id, state.flatEntries.length);
  state.progressBarLabel.textContent = t("vocabulary.progress.label", { completed: stats.mastered, total: stats.total });
  state.progressBarFill.style.width = `${stats.completionRate}%`;
}

function renderToolbar(partOfSpeechOptions) {
  const toolbar = createElement("div", { className: "vocab-toolbar" });

  const searchInput = createElement("input", {
    className: "vocab-search-input",
    attrs: { type: "search", placeholder: t("vocabulary.toolbar.searchPlaceholder"), "aria-label": t("vocabulary.toolbar.searchPlaceholder") }
  });
  searchInput.addEventListener("input", () => {
    state.filters.query = searchInput.value.trim().toLowerCase();
    renderFilteredSections();
  });
  toolbar.appendChild(searchInput);

  const statusGroup = createElement("div", { className: "vocab-status-filters", attrs: { role: "group" } });
  ["all", ...STATUS_KEYS].forEach((status) => {
    const button = createElement("button", {
      className: "vocab-filter-button",
      text: t(`vocabulary.status.${toCamelCase(status)}`),
      attrs: { type: "button", "data-status": status }
    });
    if (status === state.filters.status) button.classList.add("is-active");
    button.addEventListener("click", () => {
      state.filters.status = status;
      toolbar.querySelectorAll(".vocab-filter-button").forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      renderFilteredSections();
    });
    statusGroup.appendChild(button);
  });
  toolbar.appendChild(statusGroup);

  if (partOfSpeechOptions.length) {
    const select = createElement("select", {
      className: "vocab-pos-select",
      attrs: { "aria-label": t("vocabulary.toolbar.partOfSpeechLabel") }
    });
    select.appendChild(createElement("option", { text: t("vocabulary.toolbar.partOfSpeechAll"), attrs: { value: "all" } }));
    partOfSpeechOptions.forEach((pos) => {
      select.appendChild(createElement("option", { text: pos, attrs: { value: pos } }));
    });
    select.addEventListener("change", () => {
      state.filters.partOfSpeech = select.value;
      renderFilteredSections();
    });
    toolbar.appendChild(select);
  }

  return toolbar;
}

function matchesFilters(entry, progress) {
  const { query, status, partOfSpeech } = state.filters;

  if (query && !entry.searchText.includes(query)) return false;

  if (status !== "all") {
    const entryStatus = getEntryProgress(progress, entry.id).status;
    if (entryStatus !== status) return false;
  }

  if (partOfSpeech !== "all") {
    if (!Array.isArray(entry.partOfSpeech) || !entry.partOfSpeech.includes(partOfSpeech)) return false;
  }

  return true;
}

/** Rebuilds ONLY the section/card grid (not the toolbar) — safe to call on every filter change or mark-known click. */
function renderFilteredSections() {
  if (!state.sectionsContainer) return;

  const progress = loadProgress(state.lesson.id);
  const bySection = {};
  SECTION_META.forEach(({ sectionId }) => {
    bySection[sectionId] = [];
  });
  state.flatEntries.forEach((entry) => {
    if (matchesFilters(entry, progress)) bySection[entry.sectionId].push(entry);
  });

  state.sectionsContainer.innerHTML = "";
  let index = 0;
  SECTION_META.forEach(({ sectionId, titleKey }) => {
    const entries = bySection[sectionId];
    if (!entries.length) return;
    index += 1;

    const section = createElement("section", {
      className: "vocab-section",
      attrs: { id: sectionId, "aria-labelledby": `${sectionId}-title` }
    });
    section.appendChild(
      createElement("h2", { className: "vocab-section-title", text: `${index}. ${t(titleKey)}`, attrs: { id: `${sectionId}-title` } })
    );

    const grid = createElement("ul", { className: "vocab-card-grid" });
    entries.forEach((entry) => grid.appendChild(renderCardForEntry(entry, getEntryProgress(progress, entry.id))));
    section.appendChild(grid);

    state.sectionsContainer.appendChild(section);
  });

  updateProgressBar();
}

/**
 * Renders a Vocabulary lesson. `lesson` is the data/lessons/{id}.json record
 * (metadata + prev/next); `vocabularySet` is the data/vocabulary/{id}.json record.
 */
function renderVocabularyLesson(lesson, vocabularySet) {
  const headerContainer = document.getElementById("lesson-header");
  const tocContainer = document.getElementById("table-of-contents");
  const contentContainer = document.getElementById("lesson-content");
  const paginationContainer = document.getElementById("lesson-pagination");

  if (!headerContainer || !tocContainer || !contentContainer || !paginationContainer) {
    console.error("Không tìm thấy vùng giao diện bài học trong DOM.");
    return;
  }

  state.lesson = lesson;
  state.vocabularySet = vocabularySet;
  state.flatEntries = getFlatEntries(vocabularySet);
  state.filters = { query: "", status: "all", partOfSpeech: "all" };

  const sectionEntries = {};
  SECTION_META.forEach(({ sectionId }) => {
    sectionEntries[sectionId] = [];
  });
  state.flatEntries.forEach((entry) => sectionEntries[entry.sectionId].push(entry));

  headerContainer.innerHTML = "";
  headerContainer.appendChild(renderVocabularyHeader(lesson, vocabularySet));

  const sectionsWithEntries = SECTION_META.filter(({ sectionId }) => sectionEntries[sectionId].length > 0);

  tocContainer.innerHTML = "";
  tocContainer.setAttribute("aria-label", t("lesson.tableOfContents"));
  tocContainer.appendChild(renderVocabularyToc(sectionsWithEntries));

  contentContainer.innerHTML = "";
  contentContainer.appendChild(renderProgressBar());
  contentContainer.appendChild(renderToolbar(collectPartsOfSpeech(state.flatEntries)));

  state.sectionsContainer = createElement("div", { className: "vocab-sections" });
  contentContainer.appendChild(state.sectionsContainer);
  renderFilteredSections();

  paginationContainer.innerHTML = "";
  paginationContainer.setAttribute("aria-label", t("navigation.paginationLabel"));
  paginationContainer.appendChild(renderLessonNavigation(lesson));
}

export { renderVocabularyLesson, renderCardForEntry, renderWordCard, renderWordFamilyCard, renderWordPatternCard };
