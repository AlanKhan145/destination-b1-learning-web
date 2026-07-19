// question-loader.js
// Only module that knows about data/question-bank/ paths. Everything else asks
// this module for questions by id or by filter — it never hands out raw file paths.
//
// Loading strategy (see docs/question-bank.md, "Loading strategy"):
//   index.json (all question metadata + paths) is fetched once and cached.
//   Individual question files are fetched lazily, on demand, and cached by id.
//   Per-unit manifests exist for callers that only need "all ids in this unit"
//   without pulling in the (larger) full-bank index.

import { shuffle } from "./utils.js";

const QUESTION_BANK_BASE = "./data/question-bank";

let indexPromise = null;
const manifestCache = new Map(); // unitId -> Promise<manifest>
const questionCache = new Map(); // questionId -> Promise<question>

async function fetchJson(url, notFoundError) {
  const response = await fetch(url);
  if (response.status === 404) throw new Error(notFoundError || "not-found");
  if (!response.ok) throw new Error(`unexpected-error (${response.status}) for ${url}`);
  return response.json();
}

function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetchJson(`${QUESTION_BANK_BASE}/index.json`, "question-index-not-found").catch((error) => {
      indexPromise = null; // allow retry on next call instead of caching a permanent failure
      throw error;
    });
  }
  return indexPromise;
}

function loadManifest(unitId) {
  if (!manifestCache.has(unitId)) {
    const promise = fetchJson(`${QUESTION_BANK_BASE}/manifests/${unitId}.json`, "manifest-not-found").catch((error) => {
      manifestCache.delete(unitId);
      throw error;
    });
    manifestCache.set(unitId, promise);
  }
  return manifestCache.get(unitId);
}

/**
 * Fetches one question by id, using index.json to resolve its file path.
 * Rejects with an Error whose message is "QUESTION_NOT_FOUND" for missing questions,
 * so callers can distinguish "doesn't exist" from other failures.
 */
async function getQuestionById(questionId) {
  if (!questionCache.has(questionId)) {
    const promise = (async () => {
      const index = await loadIndex();
      const entry = index.questions.find((q) => q.id === questionId);
      if (!entry) throw new Error("QUESTION_NOT_FOUND");

      try {
        return await fetchJson(`${QUESTION_BANK_BASE}/${entry.path}`, "QUESTION_NOT_FOUND");
      } catch (error) {
        throw new Error("QUESTION_NOT_FOUND");
      }
    })();

    promise.catch(() => questionCache.delete(questionId)); // don't cache failures
    questionCache.set(questionId, promise);
  }

  return questionCache.get(questionId);
}

/**
 * Loads several questions by id. Never throws for individual missing/broken
 * questions — those are collected in `errors` (and logged) so one bad file
 * can't take down an entire review attempt.
 */
async function getQuestionsByIds(questionIds) {
  const results = await Promise.allSettled(questionIds.map((id) => getQuestionById(id)));

  const questions = [];
  const errors = [];

  results.forEach((result, i) => {
    const questionId = questionIds[i];
    if (result.status === "fulfilled") {
      questions.push(result.value);
    } else {
      errors.push({ questionId, error: "QUESTION_NOT_FOUND" });
      console.error(`[question-loader] failed to load question "${questionId}":`, result.reason);
    }
  });

  return { questions, errors };
}

function toArray(value) {
  if (value === undefined || value === null) return null;
  return Array.isArray(value) ? value : [value];
}

/** Accepts both singular (unitId/topicId) and plural (unitIds/topicIds) filter keys. */
function normalizeFilter(filter = {}) {
  return {
    unitIds: toArray(filter.unitIds ?? filter.unitId),
    topicIds: toArray(filter.topicIds ?? filter.topicId),
    types: toArray(filter.types ?? filter.type),
    difficulties: toArray(filter.difficulties ?? filter.difficulty),
    status: toArray(filter.status) || ["published"]
  };
}

function matchesFilter(entry, normalized) {
  if (normalized.unitIds && !normalized.unitIds.includes(entry.unitId)) return false;
  if (normalized.topicIds && !normalized.topicIds.includes(entry.topicId)) return false;
  if (normalized.types && !normalized.types.includes(entry.type)) return false;
  if (normalized.difficulties && !normalized.difficulties.includes(entry.difficulty)) return false;
  if (normalized.status && !normalized.status.includes(entry.status)) return false;
  return true;
}

async function getIndexEntriesByFilter(filter) {
  const index = await loadIndex();
  const normalized = normalizeFilter(filter);
  return index.questions.filter((entry) => matchesFilter(entry, normalized));
}

/** Returns fully-loaded questions matching a filter (unit/topic/type/difficulty/status). */
async function getQuestionsByFilter(filter) {
  const entries = await getIndexEntriesByFilter(filter);
  return getQuestionsByIds(entries.map((entry) => entry.id));
}

/**
 * Picks `count` random questions matching `filter`, never repeating a question
 * within the same call. If `distribution` is given (e.g. { "multiple-choice": 7,
 * "short-answer": 4 }), each type is sampled independently to hit its target count.
 * `avoidIds` excludes questions (e.g. ones answered in a recent attempt).
 */
async function getRandomQuestions(filter, count, { distribution, avoidIds } = {}) {
  const entries = await getIndexEntriesByFilter(filter);
  const avoid = new Set(avoidIds || []);
  const pool = entries.filter((entry) => !avoid.has(entry.id));

  let selected;
  if (distribution && Object.keys(distribution).length) {
    selected = [];
    for (const [type, typeCount] of Object.entries(distribution)) {
      const typePool = shuffle(pool.filter((entry) => entry.type === type));
      selected.push(...typePool.slice(0, typeCount));
    }
  } else {
    selected = shuffle(pool).slice(0, count);
  }

  const ids = shuffle(selected).map((entry) => entry.id);
  return getQuestionsByIds(ids);
}

async function getQuestionsByUnit(unitId) {
  return getQuestionsByFilter({ unitId, status: ["published"] });
}

async function getQuestionsByTopic(unitId, topicId) {
  return getQuestionsByFilter({ unitId, topicId, status: ["published"] });
}

export {
  getQuestionById,
  getQuestionsByIds,
  getQuestionsByFilter,
  getRandomQuestions,
  getQuestionsByUnit,
  getQuestionsByTopic,
  loadManifest
};
