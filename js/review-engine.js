// review-engine.js
// Owns review attempt state: resolving a review config into an ordered list of
// questions, tracking answers/navigation, persisting progress to localStorage,
// and producing the final score. Rendering and data fetching are delegated to
// the renderers/ modules and question-loader.js respectively.
import { getQuestionsByIds, getRandomQuestions } from "./question-loader.js";
import { validateAnswer } from "./answer-validator.js";
import { computeScore } from "./score-calculator.js";

const REVIEW_ID_PATTERN = /^[a-z0-9-]+$/;
const STORAGE_PREFIX = "db1-review-attempt:";

function isValidReviewId(reviewId) {
  return typeof reviewId === "string" && REVIEW_ID_PATTERN.test(reviewId);
}

async function loadReview(reviewId) {
  if (!isValidReviewId(reviewId)) throw new Error("review-not-found");

  const response = await fetch(`./data/reviews/${reviewId}.json`);
  if (response.status === 404) throw new Error("review-not-found");
  if (!response.ok) throw new Error("unexpected-error");

  return response.json();
}

/**
 * Builds an in-memory review config for "Practice this topic" (spec section 18).
 * Never written to data/reviews/ — generated fresh each time the learner clicks the button.
 */
function createTopicPracticeReview(unitId, topicId, questionCount = 10) {
  return {
    id: `practice-${unitId}-${topicId}`,
    unitId,
    title: topicId,
    passingScore: 0,
    attemptSettings: { allowRetry: true, showCorrectAnswer: "after-submit", showExplanation: "after-submit", saveProgress: false },
    sections: [
      {
        id: "practice",
        type: "mixed",
        selectionMode: "random",
        questionCount,
        questionFilter: { unitIds: [unitId], topicIds: [topicId], status: ["published"] },
        shuffleQuestions: true
      }
    ]
  };
}

function storageKey(reviewId) {
  return `${STORAGE_PREFIX}${reviewId}`;
}

function readSavedAttempt(reviewId) {
  try {
    const raw = localStorage.getItem(storageKey(reviewId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`[review-engine] failed to read saved attempt for "${reviewId}":`, error);
    return null;
  }
}

function writeSavedAttempt(reviewId, snapshot) {
  try {
    localStorage.setItem(storageKey(reviewId), JSON.stringify(snapshot));
  } catch (error) {
    console.error(`[review-engine] failed to save attempt for "${reviewId}":`, error);
  }
}

function clearSavedAttempt(reviewId) {
  try {
    localStorage.removeItem(storageKey(reviewId));
  } catch (error) {
    console.error(`[review-engine] failed to clear saved attempt for "${reviewId}":`, error);
  }
}

/** Resolves every section into a flat, ordered { questionId, sectionId } list. Does not fetch full question content. */
async function resolveSectionQuestionIds(review) {
  const ordered = [];
  const usedIds = new Set();

  for (const section of review.sections) {
    let sectionEntries;

    if (section.selectionMode === "fixed") {
      sectionEntries = (section.questionIds || []).map((id) => ({ questionId: id, sectionId: section.id }));
    } else {
      const { questions } = await getRandomQuestions(section.questionFilter, section.questionCount, {
        distribution: section.distribution,
        avoidIds: Array.from(usedIds)
      });
      sectionEntries = questions.map((q) => ({ questionId: q.id, sectionId: section.id }));
    }

    sectionEntries.forEach((entry) => usedIds.add(entry.questionId));
    ordered.push(...sectionEntries);
  }

  return ordered;
}

/** Builds a fresh (non-resumed) attempt: resolves sections, loads question content, persists initial state. */
async function buildFreshAttempt(review) {
  const plannedIds = await resolveSectionQuestionIds(review);
  const { questions, errors } = await getQuestionsByIds(plannedIds.map((entry) => entry.questionId));

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const entries = plannedIds
    .filter((planned) => questionById.has(planned.questionId))
    .map((planned) => ({
      questionId: planned.questionId,
      sectionId: planned.sectionId,
      question: questionById.get(planned.questionId),
      answer: null,
      result: null
    }));

  const attempt = {
    attemptId: `attempt-${Date.now()}`,
    reviewId: review.id,
    review,
    entries,
    currentIndex: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "in-progress",
    loadErrors: errors
  };

  if (review.attemptSettings?.saveProgress) persistAttempt(attempt);

  return attempt;
}

/** Resumes a saved attempt if one exists for this review and its questions still load successfully. */
async function tryResumeAttempt(review) {
  if (!review.attemptSettings?.saveProgress) return null;

  const saved = readSavedAttempt(review.id);
  if (!saved || saved.status !== "in-progress") return null;

  const { questions, errors } = await getQuestionsByIds(saved.questionIds);
  if (questions.length === 0) return null; // nothing left to resume; caller will start fresh

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const entries = saved.questionIds
    .filter((id) => questionById.has(id))
    .map((id) => {
      const savedAnswer = saved.answers[id];
      return {
        questionId: id,
        sectionId: saved.sectionByQuestionId[id],
        question: questionById.get(id),
        answer: savedAnswer ? savedAnswer.answer : null,
        result: savedAnswer ? validateAnswer(questionById.get(id), savedAnswer.answer) : null
      };
    });

  return {
    attemptId: saved.attemptId,
    reviewId: review.id,
    review,
    entries,
    currentIndex: Math.min(saved.currentIndex || 0, entries.length - 1),
    startedAt: saved.startedAt,
    completedAt: saved.completedAt,
    status: saved.status,
    loadErrors: errors
  };
}

function persistAttempt(attempt) {
  if (!attempt.review.attemptSettings?.saveProgress) return;

  const answers = {};
  const sectionByQuestionId = {};
  for (const entry of attempt.entries) {
    sectionByQuestionId[entry.questionId] = entry.sectionId;
    if (entry.answer !== null) answers[entry.questionId] = { answer: entry.answer, isCorrect: entry.result?.isCorrect ?? null };
  }

  writeSavedAttempt(attempt.reviewId, {
    attemptId: attempt.attemptId,
    reviewId: attempt.reviewId,
    questionIds: attempt.entries.map((entry) => entry.questionId),
    sectionByQuestionId,
    currentIndex: attempt.currentIndex,
    answers,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    status: attempt.status
  });
}

/** Entry point: builds a review attempt, resuming an in-progress one when available. */
async function startReviewAttempt(review) {
  const resumed = await tryResumeAttempt(review);
  return resumed || buildFreshAttempt(review);
}

function getCurrentEntry(attempt) {
  return attempt.entries[attempt.currentIndex] || null;
}

function getProgress(attempt) {
  return { current: attempt.entries.length ? attempt.currentIndex + 1 : 0, total: attempt.entries.length };
}

function goToIndex(attempt, index) {
  if (index < 0 || index >= attempt.entries.length) return attempt;
  attempt.currentIndex = index;
  return attempt;
}

function goToNext(attempt) {
  return goToIndex(attempt, attempt.currentIndex + 1);
}

function goToPrevious(attempt) {
  return goToIndex(attempt, attempt.currentIndex - 1);
}

/** Records the learner's raw answer for the current question without grading it yet. */
function recordAnswer(attempt, answer) {
  const entry = getCurrentEntry(attempt);
  if (!entry) return attempt;
  entry.answer = answer;
  persistAttempt(attempt);
  return attempt;
}

/** Grades the current question's recorded answer and stores the result. */
function submitCurrentAnswer(attempt) {
  const entry = getCurrentEntry(attempt);
  if (!entry) return null;
  entry.result = validateAnswer(entry.question, entry.answer);
  persistAttempt(attempt);
  return entry.result;
}

function isComplete(attempt) {
  return attempt.entries.length > 0 && attempt.entries.every((entry) => entry.result !== null);
}

/** Marks the attempt as finished and returns the score summary (score-calculator.js). */
function finishAttempt(attempt) {
  attempt.status = "completed";
  attempt.completedAt = new Date().toISOString();
  persistAttempt(attempt);
  return computeScore(attempt.review, attempt.entries.map(({ question, result }) => ({ question, result })));
}

/** Clears saved progress so the next startReviewAttempt() call starts over. */
function resetAttempt(attempt) {
  clearSavedAttempt(attempt.reviewId);
}

export {
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
};
