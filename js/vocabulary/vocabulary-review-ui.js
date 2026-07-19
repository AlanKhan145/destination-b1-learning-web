// vocabulary-review-ui.js
// The single entry point both the Home widget and the lesson page's
// "Quick review" button call: openVocabularyQuickReview(unitId). Renders a
// mode-select -> mode screen -> summary state machine into
// #vocab-review-overlay, mirroring review-panel.js's structure. No review
// logic lives anywhere else (Home just calls this function with a unitId).

import { t } from "../i18n.js";
import { createElement } from "../utils.js";
import { loadVocabularySet, getFlatEntries } from "./vocabulary-data.js";
import {
  SEQUENTIAL_MODES,
  MATCHING_VARIANTS,
  startQuickReview,
  getCurrentItem,
  buildChooseMeaningItem,
  buildChooseImageItem,
  recordAnswer,
  recordSelfGrade,
  goToNext,
  finishQuickReview,
  buildMatchingPairs,
  recordMatchingCompletion
} from "./vocabulary-review-engine.js";
import { render as renderMcq } from "./vocabulary-mcq-renderer.js";
import { renderMatching } from "./matching-engine.js";
import { gradeTyped } from "./vocabulary-grader.js";
import { speak, isSpeechSupported } from "./pronounce.js";

const MODE_LABEL_KEYS = {
  flashcard: "vocabulary.review.modeFlashcard",
  "choose-meaning": "vocabulary.review.modeChooseMeaning",
  "choose-image": "vocabulary.review.modeChooseImage",
  "type-word": "vocabulary.review.modeTypeWord",
  matching: "vocabulary.review.modeMatching"
};

const MATCHING_VARIANT_LABEL_KEYS = {
  "word-meaning": "vocabulary.review.matchWordMeaning",
  "word-image": "vocabulary.review.matchWordImage",
  "root-form": "vocabulary.review.matchRootForm",
  "adjective-preposition": "vocabulary.review.matchAdjectivePreposition"
};

let bodyEl = null;
const state = { unitId: null, flatEntries: [], session: null };

function getOverlay() {
  return document.getElementById("vocab-review-overlay");
}

function handleEscape(event) {
  if (event.key === "Escape") closeOverlay();
}

function closeOverlay() {
  const overlay = getOverlay();
  if (overlay) overlay.hidden = true;
  document.removeEventListener("keydown", handleEscape);
}

function clearBody() {
  bodyEl.innerHTML = "";
}

function renderHeader(titleText) {
  const header = createElement("div", { className: "vocab-review-header" });
  header.appendChild(createElement("h2", { className: "vocab-review-title", text: titleText }));
  const closeButton = createElement("button", {
    className: "vocab-review-close",
    text: t("vocabulary.review.close"),
    attrs: { type: "button", "aria-label": t("vocabulary.review.close") }
  });
  closeButton.addEventListener("click", closeOverlay);
  header.append(closeButton);
  return header;
}

function renderExample(example) {
  if (!example) return null;
  const wrapper = createElement("div", { className: "vocab-example" });
  if (example.en) wrapper.appendChild(createElement("p", { className: "vocab-example-en", text: example.en }));
  if (example.vi) wrapper.appendChild(createElement("p", { className: "vocab-example-vi", text: example.vi }));
  return wrapper;
}

function renderLoading() {
  clearBody();
  bodyEl.appendChild(renderHeader(t("vocabulary.review.title")));
  bodyEl.appendChild(createElement("p", { className: "vocab-review-loading", text: "…" }));
}

function renderEmptyState() {
  clearBody();
  bodyEl.appendChild(renderHeader(t("vocabulary.review.title")));
  bodyEl.appendChild(createElement("p", { className: "vocab-review-empty", text: t("vocabulary.review.noWordsAvailable") }));
}

function renderModeSelectScreen() {
  clearBody();
  bodyEl.appendChild(renderHeader(t("vocabulary.review.title")));
  bodyEl.appendChild(createElement("p", { className: "vocab-review-subtitle", text: t("vocabulary.review.chooseMode") }));

  const list = createElement("div", { className: "vocab-mode-list" });
  [...SEQUENTIAL_MODES, "matching"].forEach((mode) => {
    const button = createElement("button", { className: "vocab-mode-button", text: t(MODE_LABEL_KEYS[mode]), attrs: { type: "button" } });
    button.addEventListener("click", () => {
      if (mode === "matching") renderMatchingVariantScreen();
      else startSequentialSession(mode);
    });
    list.appendChild(button);
  });
  bodyEl.appendChild(list);
}

function startSequentialSession(mode) {
  const session = startQuickReview(state.unitId, state.flatEntries, { mode });
  if (!session.items.length) {
    renderEmptyState();
    return;
  }
  state.session = session;
  renderSequentialItemScreen();
}

function advanceSession() {
  const hasNext = goToNext(state.session);
  if (hasNext) renderSequentialItemScreen();
  else renderSummaryScreen(finishQuickReview(state.session));
}

/** Shared "Check answer" -> feedback -> "Next"/"Finish" control flow for the 3 graded sequential modes. */
function renderCheckAndNext(controls, gradeFn) {
  controls.innerHTML = "";
  const checkButton = createElement("button", { className: "review-primary-button", text: t("vocabulary.review.submit"), attrs: { type: "button" } });
  checkButton.addEventListener("click", () => {
    gradeFn();
    controls.innerHTML = "";
    const isLast = state.session.index === state.session.items.length - 1;
    const nextButton = createElement("button", {
      className: "review-primary-button",
      text: isLast ? t("vocabulary.review.finish") : t("vocabulary.review.next"),
      attrs: { type: "button" }
    });
    nextButton.addEventListener("click", advanceSession);
    controls.appendChild(nextButton);
  });
  controls.appendChild(checkButton);
}

function renderFlashcard(contentEl, controls) {
  const entry = getCurrentItem(state.session);

  const front = createElement("div", { className: "vocab-flashcard-front" });
  front.appendChild(createElement("img", { className: "vocab-flashcard-image", attrs: { src: entry.image, loading: "lazy", alt: entry.imageAlt || "" } }));
  front.appendChild(createElement("p", { className: "vocab-flashcard-word", text: entry.displayText }));
  if (entry.phonetic) front.appendChild(createElement("p", { className: "vocab-phonetic", text: entry.phonetic }));

  if (isSpeechSupported()) {
    const listenButton = createElement("button", { className: "vocab-action-button", text: t("vocabulary.card.listen"), attrs: { type: "button" } });
    listenButton.addEventListener("click", () => speak(entry.displayText));
    front.appendChild(listenButton);
  }
  contentEl.appendChild(front);

  const back = createElement("div", { className: "vocab-flashcard-back", attrs: { hidden: "hidden" } });
  if (entry.meaningVi) back.appendChild(createElement("p", { className: "vocab-meaning-vi", text: entry.meaningVi }));
  if (entry.definitionEn) back.appendChild(createElement("p", { className: "vocab-definition", text: entry.definitionEn }));
  if (entry.usageEn) back.appendChild(createElement("p", { className: "vocab-definition", text: entry.usageEn }));
  const exampleEl = renderExample(entry.example);
  if (exampleEl) back.appendChild(exampleEl);
  contentEl.appendChild(back);

  const showMeaningButton = createElement("button", { className: "review-primary-button", text: t("vocabulary.review.showMeaning"), attrs: { type: "button" } });
  showMeaningButton.addEventListener("click", () => {
    back.hidden = false;
    showMeaningButton.hidden = true;
    renderGradeButtons(controls);
  });
  controls.appendChild(showMeaningButton);
}

function renderGradeButtons(controls) {
  controls.innerHTML = "";
  [
    { grade: "forgot", key: "vocabulary.review.forgot" },
    { grade: "hard", key: "vocabulary.review.hard" },
    { grade: "know", key: "vocabulary.review.know" }
  ].forEach(({ grade, key }) => {
    const button = createElement("button", { className: "review-secondary-button vocab-grade-button", text: t(key), attrs: { type: "button" } });
    button.addEventListener("click", () => {
      recordSelfGrade(state.session, grade);
      advanceSession();
    });
    controls.appendChild(button);
  });
}

function renderChooseMeaning(contentEl, controls) {
  const item = buildChooseMeaningItem(state.session);
  const entry = item.entry;

  const prompt = createElement("div", { className: "vocab-review-prompt" });
  prompt.appendChild(createElement("img", { className: "vocab-review-prompt-image", attrs: { src: entry.image, loading: "lazy", alt: entry.imageAlt || "" } }));
  prompt.appendChild(createElement("p", { className: "vocab-review-prompt-word", text: entry.displayText }));
  contentEl.appendChild(prompt);

  const answerArea = createElement("div", { className: "vocab-review-answer-area" });
  contentEl.appendChild(answerArea);
  const handle = renderMcq(item, answerArea, {});

  renderCheckAndNext(controls, () => {
    const isCorrect = handle.getAnswer() === item.id;
    handle.showFeedback(item.id);
    handle.disable();
    recordAnswer(state.session, isCorrect);
  });
}

function renderChooseImage(contentEl, controls) {
  const item = buildChooseImageItem(state.session);

  const prompt = createElement("div", { className: "vocab-review-prompt" });
  prompt.appendChild(createElement("img", { className: "vocab-review-prompt-image", attrs: { src: item.promptImage, loading: "lazy", alt: "" } }));
  contentEl.appendChild(prompt);

  const answerArea = createElement("div", { className: "vocab-review-answer-area" });
  contentEl.appendChild(answerArea);
  const handle = renderMcq(item, answerArea, {});

  renderCheckAndNext(controls, () => {
    const isCorrect = handle.getAnswer() === item.id;
    handle.showFeedback(item.id);
    handle.disable();
    recordAnswer(state.session, isCorrect);
  });
}

function renderTypeWord(contentEl, controls) {
  const entry = getCurrentItem(state.session);

  const prompt = createElement("div", { className: "vocab-review-prompt" });
  prompt.appendChild(createElement("img", { className: "vocab-review-prompt-image", attrs: { src: entry.image, loading: "lazy", alt: entry.imageAlt || "" } }));
  if (entry.meaningVi) prompt.appendChild(createElement("p", { className: "vocab-meaning-vi", text: entry.meaningVi }));
  contentEl.appendChild(prompt);

  const input = createElement("input", {
    className: "short-answer-input vocab-type-input",
    attrs: { type: "text", placeholder: t("vocabulary.review.typeAnswerPlaceholder"), autocomplete: "off" }
  });
  contentEl.appendChild(input);

  const feedback = createElement("p", { className: "vocab-review-feedback" });
  contentEl.appendChild(feedback);

  renderCheckAndNext(controls, () => {
    const isCorrect = gradeTyped(input.value, entry.displayText, entry.variants || []);
    input.disabled = true;
    input.classList.add(isCorrect ? "is-correct" : "is-incorrect");
    feedback.textContent = isCorrect ? t("vocabulary.review.correct") : `${t("vocabulary.review.incorrect")} — ${entry.displayText}`;
    recordAnswer(state.session, isCorrect);
  });
}

function renderSequentialItemScreen() {
  clearBody();
  const { mode, index, items } = state.session;
  bodyEl.appendChild(renderHeader(t(MODE_LABEL_KEYS[mode])));
  bodyEl.appendChild(createElement("p", { className: "vocab-review-progress", text: t("review.questionOf", { current: index + 1, total: items.length }) }));

  const contentEl = createElement("div", { className: "vocab-review-content" });
  bodyEl.appendChild(contentEl);
  const controls = createElement("div", { className: "review-controls" });
  bodyEl.appendChild(controls);

  if (mode === "flashcard") renderFlashcard(contentEl, controls);
  else if (mode === "choose-meaning") renderChooseMeaning(contentEl, controls);
  else if (mode === "choose-image") renderChooseImage(contentEl, controls);
  else if (mode === "type-word") renderTypeWord(contentEl, controls);
}

function renderMatchingVariantScreen() {
  clearBody();
  bodyEl.appendChild(renderHeader(t("vocabulary.review.modeMatching")));
  bodyEl.appendChild(createElement("p", { className: "vocab-review-subtitle", text: t("vocabulary.review.chooseMode") }));

  const list = createElement("div", { className: "vocab-mode-list" });
  MATCHING_VARIANTS.forEach((variant) => {
    const button = createElement("button", {
      className: "vocab-mode-button",
      text: t(MATCHING_VARIANT_LABEL_KEYS[variant]),
      attrs: { type: "button" }
    });
    button.addEventListener("click", () => startMatchingRound(variant));
    list.appendChild(button);
  });
  bodyEl.appendChild(list);

  const backButton = createElement("button", { className: "review-secondary-button", text: t("vocabulary.review.previous"), attrs: { type: "button" } });
  backButton.addEventListener("click", renderModeSelectScreen);
  bodyEl.appendChild(backButton);
}

function startMatchingRound(variant) {
  const pairs = buildMatchingPairs(state.flatEntries, variant);
  if (pairs.length < 2) {
    renderEmptyState();
    return;
  }

  clearBody();
  bodyEl.appendChild(renderHeader(t(MATCHING_VARIANT_LABEL_KEYS[variant])));
  bodyEl.appendChild(createElement("p", { className: "vocab-review-subtitle", text: t("vocabulary.review.matchingInstructions") }));

  const matchContainer = createElement("div", { className: "vocab-matching-container" });
  bodyEl.appendChild(matchContainer);

  renderMatching(pairs, matchContainer, {
    onComplete: ({ totalPairs }) => {
      recordMatchingCompletion(state.unitId, pairs);
      renderSummaryScreen({ correct: totalPairs, total: totalPairs });
    }
  });
}

function renderSummaryScreen(result) {
  clearBody();
  bodyEl.appendChild(renderHeader(t("vocabulary.review.summaryTitle")));
  bodyEl.appendChild(
    createElement("p", { className: "vocab-review-score", text: `${t("vocabulary.review.correctLabel")}: ${result.correct}/${result.total}` })
  );

  const controls = createElement("div", { className: "review-controls" });
  const againButton = createElement("button", { className: "review-primary-button", text: t("vocabulary.review.reviewAgain"), attrs: { type: "button" } });
  againButton.addEventListener("click", renderModeSelectScreen);
  const closeButton = createElement("button", { className: "review-secondary-button", text: t("vocabulary.review.close"), attrs: { type: "button" } });
  closeButton.addEventListener("click", closeOverlay);
  controls.append(againButton, closeButton);
  bodyEl.appendChild(controls);
}

/** Opens the quick-review overlay for `unitId`. The one function Home and the lesson page both call. */
async function openVocabularyQuickReview(unitId) {
  const overlay = getOverlay();
  if (!overlay) return;

  overlay.hidden = false;
  overlay.innerHTML = "";
  document.addEventListener("keydown", handleEscape);

  bodyEl = createElement("div", {
    className: "vocab-review-panel",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": t("vocabulary.review.title") }
  });
  overlay.appendChild(bodyEl);

  renderLoading();

  try {
    const vocabularySet = await loadVocabularySet(unitId);
    state.unitId = unitId;
    state.flatEntries = getFlatEntries(vocabularySet);
    state.session = null;
    renderModeSelectScreen();
  } catch (error) {
    console.error("[vocabulary-review-ui] failed to load vocabulary set:", error);
    renderEmptyState();
  }
}

export { openVocabularyQuickReview };
