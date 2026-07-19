// vocabulary-selection.js
// Pure weighted word-selection logic for quick review sessions — no DOM, no
// fetch, no localStorage (progress is passed in). Not unit-3-specific.
//
// Priority order (highest chance of being picked first): needs-review >
// answered wrong more often than right > overdue (past its nextReviewAt) >
// learning > new > mastered. Implemented as the Efraimidis-Spirakis weighted
// sampling-without-replacement algorithm: each entry gets a random key
// U^(1/weight), and the top `count` keys are taken. This guarantees no
// duplicate ids in a single call (so no immediate repeat of the same word)
// and, for a single draw, gives each entry exactly weight_i / sum(weights)
// probability of being chosen — a well-understood, unbiased scheme.

const DEFAULT_WEIGHTS = {
  needsReview: 5,
  incorrect: 4,
  overdue: 3,
  learning: 2,
  new: 1,
  mastered: 0.5
};

const DEFAULT_ENTRY_PROGRESS = { status: "new", correctCount: 0, incorrectCount: 0, nextReviewAt: null };

/** Picks the single highest-priority tier that applies to this word's progress. */
function priorityWeightFor(entryProgress, weights, now) {
  const { status, correctCount, incorrectCount, nextReviewAt } = entryProgress;

  if (status === "needs-review") return weights.needsReview;
  if (incorrectCount > correctCount) return weights.incorrect;
  if (nextReviewAt && new Date(nextReviewAt).getTime() <= now) return weights.overdue;
  if (status === "learning") return weights.learning;
  if (status === "mastered") return weights.mastered;
  return weights.new;
}

/**
 * Selects up to `count` unique entries from `entries`, weighted by review
 * priority. `progress` is a loadProgress()-shaped object (`{ entries: {...} }`);
 * missing/unknown ids are treated as untouched ("new") words.
 * `options.avoidIds` excludes ids entirely (e.g. already used earlier in the
 * same session); `options.weights` overrides individual tiers; `options.now`
 * is injectable for deterministic tests.
 */
function selectReviewWords(entries, progress, count, options = {}) {
  if (count <= 0) return [];

  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const avoidIds = new Set(options.avoidIds || []);
  const now = options.now ?? Date.now();
  const progressEntries = progress?.entries || {};

  const pool = entries.filter((entry) => !avoidIds.has(entry.id));
  if (!pool.length) return [];

  const keyed = pool.map((entry) => {
    const entryProgress = progressEntries[entry.id] || DEFAULT_ENTRY_PROGRESS;
    const weight = Math.max(priorityWeightFor(entryProgress, weights, now), 0.0001);
    return { entry, key: Math.random() ** (1 / weight) };
  });

  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, count).map((item) => item.entry);
}

export { selectReviewWords, priorityWeightFor, DEFAULT_WEIGHTS };
