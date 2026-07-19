import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { withMemoryLocalStorage } from "../test-helpers/static-server.js";
import { loadProgress, getEntryProgress, setStatus, recordAttempt, getStats } from "./vocabulary-progress.js";

let restoreLocalStorage;

before(() => {
  restoreLocalStorage = withMemoryLocalStorage();
});

after(() => {
  restoreLocalStorage();
});

beforeEach(() => {
  localStorage.clear();
});

describe("loadProgress / getEntryProgress", () => {
  test("returns an empty progress map for a unit with no saved data", () => {
    const progress = loadProgress("unit-3");
    assert.deepEqual(progress, { unitId: "unit-3", entries: {} });
  });

  test("an unseen word defaults to status 'new' with zero counts", () => {
    const progress = loadProgress("unit-3");
    const entry = getEntryProgress(progress, "vocab-unit-3-beat");
    assert.equal(entry.status, "new");
    assert.equal(entry.correctCount, 0);
    assert.equal(entry.incorrectCount, 0);
  });
});

describe("setStatus (manual mark-known / mark-for-review)", () => {
  test("persists a manual status override across a fresh load", () => {
    setStatus("unit-3", "vocab-unit-3-beat", "mastered");
    const progress = loadProgress("unit-3");
    assert.equal(getEntryProgress(progress, "vocab-unit-3-beat").status, "mastered");
  });

  test("rejects an invalid status", () => {
    assert.throws(() => setStatus("unit-3", "vocab-unit-3-beat", "bogus"));
  });
});

describe("recordAttempt (quiz/flashcard grading)", () => {
  test("a wrong answer always sends the word to needs-review", () => {
    setStatus("unit-3", "vocab-unit-3-beat", "mastered");
    recordAttempt("unit-3", "vocab-unit-3-beat", false);
    const progress = loadProgress("unit-3");
    assert.equal(getEntryProgress(progress, "vocab-unit-3-beat").status, "needs-review");
  });

  test("a new word needs two correct answers before being mastered", () => {
    recordAttempt("unit-3", "vocab-unit-3-champion", true);
    let progress = loadProgress("unit-3");
    assert.equal(getEntryProgress(progress, "vocab-unit-3-champion").status, "learning");

    recordAttempt("unit-3", "vocab-unit-3-champion", true);
    progress = loadProgress("unit-3");
    assert.equal(getEntryProgress(progress, "vocab-unit-3-champion").status, "mastered");
  });

  test("tracks correct/incorrect counts independently of status", () => {
    recordAttempt("unit-3", "vocab-unit-3-team", true);
    recordAttempt("unit-3", "vocab-unit-3-team", false);
    recordAttempt("unit-3", "vocab-unit-3-team", true);
    const entry = getEntryProgress(loadProgress("unit-3"), "vocab-unit-3-team");
    assert.equal(entry.correctCount, 2);
    assert.equal(entry.incorrectCount, 1);
  });
});

describe("getStats", () => {
  test("untouched words all count as 'new'", () => {
    const stats = getStats("unit-3", 66);
    assert.deepEqual(stats, { total: 66, new: 66, learning: 0, needsReview: 0, mastered: 0, completionRate: 0 });
  });

  test("aggregates mixed statuses and computes completionRate from mastered/total", () => {
    setStatus("unit-3", "vocab-unit-3-beat", "mastered");
    setStatus("unit-3", "vocab-unit-3-team", "learning");
    setStatus("unit-3", "vocab-unit-3-score", "needs-review");

    const stats = getStats("unit-3", 66);
    assert.equal(stats.mastered, 1);
    assert.equal(stats.learning, 1);
    assert.equal(stats.needsReview, 1);
    assert.equal(stats.new, 63);
    assert.equal(stats.completionRate, Math.round((1 / 66) * 100));
  });

  test("progress for one unit never leaks into another unit's stats", () => {
    setStatus("unit-3", "vocab-unit-3-beat", "mastered");
    const otherStats = getStats("unit-4", 10);
    assert.equal(otherStats.mastered, 0);
    assert.equal(otherStats.new, 10);
  });
});
