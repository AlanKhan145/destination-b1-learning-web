// vocabulary-progress.js
// Per-word learning-status tracking, persisted to localStorage. Mirrors
// review-engine.js's storageKey/read/write pattern exactly. Not unit-3-specific
// — every function takes a unitId.

const STORAGE_PREFIX = "db1-vocab-progress:";
const STATUSES = ["new", "learning", "needs-review", "mastered"];
const DEFAULT_ENTRY = { status: "new", correctCount: 0, incorrectCount: 0, lastReviewedAt: null, nextReviewAt: null };

// How long until a word is due again, per status, once reviewed.
const REVIEW_INTERVAL_DAYS = { learning: 1, "needs-review": 1, mastered: 7 };

function storageKey(unitId) {
  return `${STORAGE_PREFIX}${unitId}`;
}

function readStoredProgress(unitId) {
  try {
    const raw = localStorage.getItem(storageKey(unitId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`[vocabulary-progress] failed to read progress for "${unitId}":`, error);
    return null;
  }
}

function writeStoredProgress(unitId, progress) {
  try {
    localStorage.setItem(storageKey(unitId), JSON.stringify(progress));
  } catch (error) {
    console.error(`[vocabulary-progress] failed to save progress for "${unitId}":`, error);
  }
}

/** Loads the progress map for a unit, `{ unitId, entries: { [vocabId]: {...} } }`. Never returns null. */
function loadProgress(unitId) {
  const saved = readStoredProgress(unitId);
  return saved && saved.unitId === unitId && saved.entries ? saved : { unitId, entries: {} };
}

function getEntryProgress(progress, vocabId) {
  return progress.entries[vocabId] || { ...DEFAULT_ENTRY };
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Learner-initiated override, e.g. the "mark as known" / "needs review" buttons. */
function setStatus(unitId, vocabId, status) {
  if (!STATUSES.includes(status)) throw new Error(`invalid vocabulary status "${status}"`);

  const progress = loadProgress(unitId);
  const existing = getEntryProgress(progress, vocabId);
  const now = new Date();

  progress.entries[vocabId] = {
    ...existing,
    status,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addDays(now, REVIEW_INTERVAL_DAYS[status] ?? 1).toISOString()
  };
  writeStoredProgress(unitId, progress);
  return progress;
}

/**
 * Records the outcome of a review-mode attempt (quiz/flashcard). Auto-derives
 * the new status: any wrong answer sends a word back to "needs-review"; two
 * correct answers in a row on a "new"/"needs-review" word promote it forward.
 */
function recordAttempt(unitId, vocabId, isCorrect) {
  const progress = loadProgress(unitId);
  const existing = getEntryProgress(progress, vocabId);
  const now = new Date();

  const correctCount = existing.correctCount + (isCorrect ? 1 : 0);
  const incorrectCount = existing.incorrectCount + (isCorrect ? 0 : 1);

  let status = existing.status;
  if (!isCorrect) {
    status = "needs-review";
  } else if (status === "new" || status === "needs-review") {
    status = correctCount >= 2 ? "mastered" : "learning";
  } else if (status === "learning") {
    status = "mastered";
  }

  progress.entries[vocabId] = {
    status,
    correctCount,
    incorrectCount,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addDays(now, REVIEW_INTERVAL_DAYS[status] ?? 1).toISOString()
  };
  writeStoredProgress(unitId, progress);
  return progress;
}

/** Aggregate stats for the Home widget / lesson progress bar. `totalCount` = size of the full vocabulary set. */
function getStats(unitId, totalCount) {
  const progress = loadProgress(unitId);
  const counts = { new: 0, learning: 0, "needs-review": 0, mastered: 0 };

  let tracked = 0;
  for (const entry of Object.values(progress.entries)) {
    if (counts[entry.status] === undefined) continue;
    counts[entry.status] += 1;
    tracked += 1;
  }
  counts.new += Math.max(0, totalCount - tracked);

  return {
    total: totalCount,
    new: counts.new,
    learning: counts.learning,
    needsReview: counts["needs-review"],
    mastered: counts.mastered,
    completionRate: totalCount > 0 ? Math.round((counts.mastered / totalCount) * 100) : 0
  };
}

export { loadProgress, getEntryProgress, setStatus, recordAttempt, getStats, STORAGE_PREFIX, STATUSES };
