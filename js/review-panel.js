// review-panel.js
// UI controller that wires question-loader / review-engine / answer-validator /
// score-calculator and the per-type renderers into the "#review-panel" region.
// Nothing here talks to fetch() or localStorage directly — that's review-engine's job.
import { t } from "./i18n.js";
import { createElement } from "./utils.js";
import { setWorkspaceTabsEnabled } from "./navigation.js";
import {
  loadReview,
  createTopicPracticeReview,
  startReviewAttempt,
  getCurrentEntry,
  getProgress,
  goToIndex,
  goToNext,
  goToPrevious,
  recordAnswer,
  submitCurrentAnswer,
  isComplete,
  finishAttempt,
  resetAttempt
} from "./review-engine.js";
import { render as renderMultipleChoice } from "./renderers/multiple-choice-renderer.js";
import { render as renderShortAnswer } from "./renderers/short-answer-renderer.js";
import { render as renderTrueFalse } from "./renderers/true-false-renderer.js";
import { render as renderSecretWordPuzzle } from "./renderers/secret-word-puzzle-renderer.js";
import { render as renderFillInTheBlanks } from "./renderers/fill-in-the-blanks-renderer.js";
import { render as renderMatching } from "./renderers/matching-renderer.js";

// Adding a new question type: write its renderer under js/renderers/, then register
// it here. Nothing else in this file needs to change for existing types to keep working.
const QUESTION_RENDERERS = {
  "multiple-choice": renderMultipleChoice,
  "short-answer": renderShortAnswer,
  "true-false": renderTrueFalse,
  "secret-word-puzzle": renderSecretWordPuzzle,
  "fill-in-the-blanks": renderFillInTheBlanks,
  matching: renderMatching
};

let panelEl = null;
let bodyEl = null;
let toggleButtonEl = null;
let currentLesson = null;
let currentAttempt = null;
let currentRendererHandle = null; // { getAnswer, showFeedback, disable } from the active renderer
let isPanelOpen = false;

function isStandaloneReview() {
  return currentLesson?.category === "Review";
}

function setStandaloneAttemptActive(active) {
  if (!isStandaloneReview()) return;
  document.getElementById("workspace")?.classList.toggle("workspace--review-active", active);
}

function getPanelElements() {
  panelEl = document.getElementById("review-panel");
  return panelEl;
}

function renderPanelChrome() {
  panelEl.innerHTML = "";
  const title = t(isStandaloneReview() ? "review.testTitle" : "review.panelTitle");
  panelEl.setAttribute("aria-label", title);

  const header = createElement("div", { className: "review-panel-header" });
  header.appendChild(createElement("h2", { className: "review-panel-title", text: title }));

  toggleButtonEl = createElement("button", {
    className: "review-panel-toggle",
    attrs: { type: "button", "aria-expanded": String(isPanelOpen) }
  });
  toggleButtonEl.textContent = isPanelOpen ? t("review.closePanel") : t("review.openPanel");
  toggleButtonEl.addEventListener("click", () => setPanelOpen(!isPanelOpen));
  header.appendChild(toggleButtonEl);

  bodyEl = createElement("div", { className: "review-panel-body" });

  panelEl.append(header, bodyEl);
}

function setPanelOpen(open) {
  isPanelOpen = open;
  panelEl.classList.toggle("is-open", open);
  panelEl.classList.toggle("is-collapsed", !open);
  if (toggleButtonEl) {
    toggleButtonEl.setAttribute("aria-expanded", String(open));
    toggleButtonEl.textContent = open ? t("review.closePanel") : t("review.openPanel");
  }
}

function clearBody() {
  bodyEl.innerHTML = "";
  currentRendererHandle = null;
}

/** Screen 1: pick between the full unit review and (implicitly) topic practice launched from the lesson content. */
function renderStartScreen() {
  setStandaloneAttemptActive(false);
  clearBody();
  const reviewConfig = currentLesson.review;

  const description = createElement("p", { className: "review-description", text: currentLesson.title });
  const startButton = createElement("button", {
    className: "review-primary-button",
    text: t(isStandaloneReview() ? "review.startTest" : "review.start")
  });
  startButton.addEventListener("click", () => {
    beginAttempt(() => loadReview(reviewConfig.reviewId));
  });

  bodyEl.append(description, startButton);
}

function renderEmptyState() {
  clearBody();
  bodyEl.appendChild(createElement("p", { className: "review-empty-state", text: t("review.emptyState") }));
  const backButton = createElement("button", { className: "review-secondary-button", text: t("result.close") });
  backButton.addEventListener("click", renderStartScreen);
  bodyEl.appendChild(backButton);
}

function renderLoadErrorNote(container) {
  if (!currentAttempt.loadErrors.length) return;
  container.appendChild(createElement("p", { className: "review-warning", text: t("review.questionLoadError") }));
}

function renderProgress(container) {
  const { current, total } = getProgress(currentAttempt);
  const wrapper = createElement("div", { className: "review-progress" });
  wrapper.appendChild(createElement("span", { className: "review-progress-label", text: t("review.questionOf", { current, total }) }));

  const track = createElement("div", { className: "review-progress-track" });
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar = createElement("div", { className: "review-progress-bar" });
  bar.style.width = `${percent}%`;
  track.appendChild(bar);

  wrapper.appendChild(track);
  container.appendChild(wrapper);
}

function renderQuestionScreen() {
  clearBody();

  if (currentAttempt.entries.length === 0) {
    renderEmptyState();
    return;
  }

  renderLoadErrorNote(bodyEl);
  renderProgress(bodyEl);

  const entry = getCurrentEntry(currentAttempt);
  const questionEl = createElement("div", { className: "review-question", attrs: { "data-question-type": entry.question.type } });
  questionEl.appendChild(createElement("p", { className: "review-question-prompt", text: entry.question.prompt }));

  const answerContainer = createElement("div", { className: "review-answer-area" });
  questionEl.appendChild(answerContainer);
  bodyEl.appendChild(questionEl);

  const renderFn = QUESTION_RENDERERS[entry.question.type];
  if (!renderFn) {
    answerContainer.appendChild(
      createElement("p", { className: "review-unsupported-type", text: `Question type "${entry.question.type}" is not supported by the UI yet.` })
    );
  } else {
    currentRendererHandle = renderFn(entry.question, answerContainer, {
      savedAnswer: entry.answer,
      onChange: (answer) => recordAnswer(currentAttempt, answer)
    });

    if (entry.result) {
      currentRendererHandle.showFeedback(entry.result);
      currentRendererHandle.disable();
    }
  }

  if (entry.result) {
    const explanation = entry.question.explanation;
    if (explanation) {
      questionEl.appendChild(createElement("p", { className: "review-explanation", text: explanation }));
    }
  }

  renderControls(questionEl, entry);
}

function renderControls(container, entry) {
  const controls = createElement("div", { className: "review-controls" });

  const previousButton = createElement("button", { className: "review-secondary-button", text: t("review.previous") });
  previousButton.disabled = currentAttempt.currentIndex === 0;
  previousButton.addEventListener("click", () => {
    goToPrevious(currentAttempt);
    renderQuestionScreen();
  });
  controls.appendChild(previousButton);

  if (!entry.result) {
    const submitButton = createElement("button", { className: "review-primary-button", text: t("review.submit") });
    submitButton.addEventListener("click", () => {
      const answer = currentRendererHandle ? currentRendererHandle.getAnswer() : entry.answer;
      recordAnswer(currentAttempt, answer);
      submitCurrentAnswer(currentAttempt);
      renderQuestionScreen();
    });
    controls.appendChild(submitButton);
  } else {
    const isLast = currentAttempt.currentIndex === currentAttempt.entries.length - 1;
    const nextLabel = isLast && isComplete(currentAttempt) ? t("review.viewResult") : t("review.next");
    const nextButton = createElement("button", { className: "review-primary-button", text: nextLabel });
    nextButton.addEventListener("click", () => {
      if (isLast && isComplete(currentAttempt)) {
        renderResultScreen(finishAttempt(currentAttempt));
      } else {
        goToNext(currentAttempt);
        renderQuestionScreen();
      }
    });
    controls.appendChild(nextButton);
  }

  container.appendChild(controls);
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function renderScoreBreakdown(title, buckets, { labelAsQuestionType = false } = {}) {
  const section = createElement("div", { className: "review-score-breakdown" });
  section.appendChild(createElement("h3", { className: "review-score-breakdown-title", text: title }));

  const list = createElement("ul", { className: "review-score-breakdown-list" });
  Object.entries(buckets).forEach(([key, { correct, total }]) => {
    const label = labelAsQuestionType ? t(`questionTypes.${toCamelCase(key)}`) : key;
    list.appendChild(createElement("li", { text: `${label}: ${correct}/${total}` }));
  });
  section.appendChild(list);
  return section;
}

function renderResultScreen(score) {
  clearBody();

  const result = createElement("div", { className: "review-result" });
  result.appendChild(createElement("h3", { className: "review-result-title", text: t("result.title") }));
  result.appendChild(
    createElement("p", { className: `review-result-status ${score.passed ? "is-passed" : "is-failed"}`, text: t(score.passed ? "review.passed" : "review.failed") })
  );
  result.appendChild(createElement("p", { className: "review-result-score", text: `${t("result.scoreLabel")}: ${score.scorePercent}%` }));
  result.appendChild(
    createElement("p", { className: "review-result-correct", text: `${t("result.correctLabel")}: ${score.correctQuestions}/${score.totalQuestions}` })
  );

  result.appendChild(renderScoreBreakdown(t("result.byTopic"), score.byTopic));
  result.appendChild(renderScoreBreakdown(t("result.byType"), score.byType, { labelAsQuestionType: true }));

  const controls = createElement("div", { className: "review-controls" });

  const retryButton = createElement("button", { className: "review-primary-button", text: t("result.retry") });
  retryButton.addEventListener("click", () => {
    resetAttempt(currentAttempt);
    beginAttempt(() => Promise.resolve(currentAttempt.review));
  });
  controls.appendChild(retryButton);

  const closeButton = createElement("button", { className: "review-secondary-button", text: t("result.close") });
  closeButton.addEventListener("click", renderStartScreen);
  controls.appendChild(closeButton);

  result.appendChild(controls);
  bodyEl.appendChild(result);
}

async function beginAttempt(loadReviewConfig) {
  clearBody();
  bodyEl.appendChild(createElement("p", { className: "review-loading", text: "…" }));

  try {
    const review = await loadReviewConfig();
    currentAttempt = await startReviewAttempt(review);
    goToIndex(currentAttempt, currentAttempt.currentIndex || 0);
    setStandaloneAttemptActive(true);
    renderQuestionScreen();
  } catch (error) {
    console.error("[review-panel] failed to start review attempt:", error);
    setStandaloneAttemptActive(false);
    renderEmptyState();
  }
}

/** Called by lesson-renderer's "Practice this topic" buttons via a delegated click listener. */
function startTopicPractice(unitId, topicId, questionCount = 10) {
  setPanelOpen(true);
  const workspace = document.getElementById("workspace");
  if (workspace) {
    workspace.dataset.activePane = "review";
    setWorkspaceTabsEnabled(true); // rebuilds the tab buttons so "Review" shows as active
  }
  beginAttempt(() => Promise.resolve(createTopicPracticeReview(unitId, topicId, questionCount)));
}

function bindTopicPracticeButtons() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-practice-topic]");
    if (!button) return;
    startTopicPractice(button.dataset.unitId, button.dataset.topicId);
  });
}

let topicPracticeBound = false;

/** Sets up (or re-renders, after a language change) the review panel for the given lesson. */
function initReviewPanel(lesson) {
  currentLesson = lesson;
  const panel = getPanelElements();
  if (!panel) return;

  const reviewConfig = lesson.review;
  if (!reviewConfig || !reviewConfig.enabled) {
    panel.hidden = true;
    document.getElementById("workspace")?.classList.add("workspace--no-review");
    setWorkspaceTabsEnabled(false);
    return;
  }

  panel.hidden = false;
  document.getElementById("workspace")?.classList.remove("workspace--no-review");
  // A Review-category page is already the test itself. Mobile Lesson/Review
  // tabs would incorrectly split it back into a lesson plus an accessory panel.
  setWorkspaceTabsEnabled(!isStandaloneReview());

  // Standalone tests have no visible collapse control, so they must always open.
  isPanelOpen = isStandaloneReview() || Boolean(reviewConfig.defaultOpen);
  renderPanelChrome();
  setPanelOpen(isPanelOpen);
  renderStartScreen();

  if (!topicPracticeBound) {
    bindTopicPracticeButtons();
    topicPracticeBound = true;
  }
}

/** Re-renders whatever screen is currently showing with fresh translated strings, without losing attempt state. */
function refreshReviewPanelLocale() {
  if (!panelEl || panelEl.hidden || !currentLesson) return;
  renderPanelChrome();
  setPanelOpen(isPanelOpen);
  if (currentAttempt && currentAttempt.status === "in-progress") {
    renderQuestionScreen();
  } else {
    renderStartScreen();
  }
}

export { initReviewPanel, refreshReviewPanelLocale, startTopicPractice };
