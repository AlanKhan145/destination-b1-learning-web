// vocabulary-review-engine.js
// In-memory quick-review session lifecycle (not persisted — a fresh session
// every time "Quick review" is opened). Builds mode-specific item payloads
// from a flat entry list + selectReviewWords(), and records results back into
// vocabulary-progress.js. Not unit-3-specific — everything takes unitId +
// flatEntries as arguments.

import { shuffle } from "../utils.js";
import { selectReviewWords } from "./vocabulary-selection.js";
import { loadProgress, recordAttempt, setStatus } from "./vocabulary-progress.js";

const SEQUENTIAL_MODES = ["flashcard", "choose-meaning", "choose-image", "type-word"];
const MATCHING_VARIANTS = ["word-meaning", "word-image", "root-form", "adjective-preposition"];
const DEFAULT_SESSION_SIZE = 10;
const OPTION_COUNT = 4;

/**
 * Word-pattern entries display a whole formula ("keen on + noun / V-ing") as
 * their `displayText`, which reads badly as a flashcard/MCQ "word" prompt and
 * is impractical to type exactly — they're reviewed instead through the
 * dedicated "adjective/verb ↔ preposition" matching variant, so every
 * sequential mode excludes them here.
 */
function eligibleEntriesForMode(flatEntries, mode) {
  const base = flatEntries.filter((entry) => entry.type !== "word-pattern");
  if (mode === "choose-image" || mode === "choose-meaning") {
    return base.filter((entry) => entry.image && (entry.meaningVi || entry.displayText));
  }
  return base;
}

/** Builds N-1 wrong options (from other entries in the pool) + the correct one, shuffled by the MCQ renderer itself. */
function buildOptions(pool, correctEntry, field, isImage) {
  const distractorPool = pool.filter((entry) => entry.id !== correctEntry.id && entry[field]);
  const distractors = shuffle(distractorPool)
    .slice(0, OPTION_COUNT - 1)
    .map((entry) => ({ id: entry.id, content: entry[field], isImage }));

  return [{ id: correctEntry.id, content: correctEntry[field], isImage }, ...distractors];
}

/**
 * Starts a sequential (flashcard / choose-meaning / choose-image / type-word)
 * quick-review session over `flatEntries` for `unitId`.
 */
function startQuickReview(unitId, flatEntries, { mode, count = DEFAULT_SESSION_SIZE } = {}) {
  const progress = loadProgress(unitId);
  const pool = eligibleEntriesForMode(flatEntries, mode);
  const words = selectReviewWords(pool, progress, Math.min(count, pool.length));

  return { unitId, flatEntries, mode, items: words, index: 0, correct: 0, total: words.length };
}

function getCurrentItem(session) {
  return session.items[session.index] || null;
}

/** Builds the choose-meaning MCQ payload for the current item. */
function buildChooseMeaningItem(session) {
  const entry = getCurrentItem(session);
  if (!entry) return null;
  const pool = eligibleEntriesForMode(session.flatEntries, "choose-meaning");
  return { id: entry.id, entry, options: buildOptions(pool, entry, "meaningVi", false) };
}

/** Builds the choose-the-picture MCQ payload for the current item. */
function buildChooseImageItem(session) {
  const entry = getCurrentItem(session);
  if (!entry) return null;
  const pool = eligibleEntriesForMode(session.flatEntries, "choose-image");
  const correctOption = { id: entry.id, content: entry.displayText, isImage: false };
  const distractorPool = pool.filter((e) => e.id !== entry.id && e.displayText);
  const distractors = shuffle(distractorPool)
    .slice(0, OPTION_COUNT - 1)
    .map((e) => ({ id: e.id, content: e.displayText, isImage: false }));
  return { id: entry.id, entry, promptImage: entry.image, options: [correctOption, ...distractors] };
}

function recordAnswer(session, isCorrect) {
  const entry = getCurrentItem(session);
  if (!entry) return;
  recordAttempt(session.unitId, entry.id, isCorrect);
  if (isCorrect) session.correct += 1;
}

/** Flashcard self-grading: "forgot" | "hard" | "know". "hard" counts as correct progress-wise but is pinned to "learning" rather than jumping straight to "mastered". */
function recordSelfGrade(session, grade) {
  const entry = getCurrentItem(session);
  if (!entry) return;
  const isCorrect = grade !== "forgot";
  recordAttempt(session.unitId, entry.id, isCorrect);
  if (grade === "hard") setStatus(session.unitId, entry.id, "learning");
  if (isCorrect) session.correct += 1;
}

/** Advances to the next item. Returns false once the session is finished. */
function goToNext(session) {
  session.index += 1;
  return session.index < session.items.length;
}

function finishQuickReview(session) {
  return { correct: session.correct, total: session.total };
}

/** Builds the pairs for one of the 4 matching variants (see matching-engine.js for the generic renderer). */
function buildMatchingPairs(flatEntries, variant, count = 6) {
  if (variant === "word-meaning") {
    const pool = flatEntries.filter((e) => e.type !== "word-family" && e.type !== "word-pattern" && e.meaningVi);
    return shuffle(pool)
      .slice(0, count)
      .map((e) => ({ id: e.id, left: e.displayText, right: e.meaningVi }));
  }

  if (variant === "word-image") {
    const pool = flatEntries.filter((e) => e.type !== "word-family" && e.type !== "word-pattern" && e.image);
    return shuffle(pool)
      .slice(0, count)
      .map((e) => ({ id: e.id, left: e.displayText, right: e.image, rightType: "image" }));
  }

  if (variant === "root-form") {
    const families = flatEntries.filter((e) => e.type === "word-family" && e.forms?.length);
    return shuffle(families)
      .slice(0, count)
      .map((family) => {
        const form = family.forms[Math.floor(Math.random() * family.forms.length)];
        return { id: family.id, left: family.root, right: form.word };
      });
  }

  if (variant === "adjective-preposition") {
    const patterns = flatEntries.filter((e) => e.type === "word-pattern" && e.prepositions?.length);
    return shuffle(patterns)
      .slice(0, count)
      .map((pattern) => ({ id: pattern.id, left: pattern.headword, right: pattern.prepositions.join(", ") }));
  }

  return [];
}

/** After a matching round completes, mark every matched word as a correct attempt. */
function recordMatchingCompletion(unitId, pairs) {
  pairs.forEach((pair) => recordAttempt(unitId, pair.id, true));
}

export {
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
  recordMatchingCompletion,
  eligibleEntriesForMode
};
