import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { selectReviewWords, DEFAULT_WEIGHTS } from "./vocabulary-selection.js";

function entry(id) {
  return { id };
}

const NOW = Date.now();

const FIXTURE_ENTRIES = [
  entry("needs-review-word"),
  entry("wrong-often-word"),
  entry("overdue-word"),
  entry("learning-word"),
  entry("new-word"),
  entry("mastered-word")
];

const FIXTURE_PROGRESS = {
  entries: {
    "needs-review-word": { status: "needs-review", correctCount: 3, incorrectCount: 1, nextReviewAt: null },
    "wrong-often-word": { status: "learning", correctCount: 1, incorrectCount: 3, nextReviewAt: null },
    "overdue-word": { status: "learning", correctCount: 3, incorrectCount: 1, nextReviewAt: new Date(NOW - 86400000).toISOString() },
    "learning-word": { status: "learning", correctCount: 2, incorrectCount: 1, nextReviewAt: new Date(NOW + 86400000).toISOString() },
    "new-word": { status: "new", correctCount: 0, incorrectCount: 0, nextReviewAt: null },
    "mastered-word": { status: "mastered", correctCount: 5, incorrectCount: 0, nextReviewAt: new Date(NOW + 86400000).toISOString() }
  }
};

describe("selectReviewWords — priority order", () => {
  test("higher-priority tiers are picked far more often across many single-word draws", () => {
    const wins = Object.fromEntries(FIXTURE_ENTRIES.map((e) => [e.id, 0]));

    const trials = 4000;
    for (let i = 0; i < trials; i++) {
      const [picked] = selectReviewWords(FIXTURE_ENTRIES, FIXTURE_PROGRESS, 1, { now: NOW });
      wins[picked.id] += 1;
    }

    // Expected order per DEFAULT_WEIGHTS: needsReview(5) > incorrect(4) > overdue(3) > learning(2) > new(1) > mastered(0.5)
    assert.ok(wins["needs-review-word"] > wins["wrong-often-word"], "needs-review should beat wrong-often");
    assert.ok(wins["wrong-often-word"] > wins["overdue-word"], "wrong-often should beat overdue");
    assert.ok(wins["overdue-word"] > wins["learning-word"], "overdue should beat learning");
    assert.ok(wins["learning-word"] > wins["new-word"], "learning should beat new");
    assert.ok(wins["new-word"] > wins["mastered-word"], "new should beat mastered");
  });

  test("a word with no progress entry at all is treated as 'new'", () => {
    const entries = [entry("untracked-word"), entry("mastered-word")];
    const wins = { "untracked-word": 0, "mastered-word": 0 };

    for (let i = 0; i < 2000; i++) {
      const [picked] = selectReviewWords(entries, FIXTURE_PROGRESS, 1, { now: NOW });
      wins[picked.id] += 1;
    }

    assert.ok(wins["untracked-word"] > wins["mastered-word"]);
  });
});

describe("selectReviewWords — no duplicates / avoidIds / edge cases", () => {
  test("never returns duplicate ids within a single call, across many repeated calls", () => {
    for (let i = 0; i < 500; i++) {
      const picked = selectReviewWords(FIXTURE_ENTRIES, FIXTURE_PROGRESS, 4, { now: NOW });
      const ids = picked.map((e) => e.id);
      assert.equal(new Set(ids).size, ids.length, `duplicate id in ${JSON.stringify(ids)}`);
    }
  });

  test("respects avoidIds", () => {
    const picked = selectReviewWords(FIXTURE_ENTRIES, FIXTURE_PROGRESS, 6, {
      now: NOW,
      avoidIds: ["needs-review-word", "wrong-often-word"]
    });
    const ids = picked.map((e) => e.id);
    assert.ok(!ids.includes("needs-review-word"));
    assert.ok(!ids.includes("wrong-often-word"));
    assert.equal(ids.length, 4);
  });

  test("count larger than the available pool just returns everything available, no crash", () => {
    const picked = selectReviewWords(FIXTURE_ENTRIES, FIXTURE_PROGRESS, 999, { now: NOW });
    assert.equal(picked.length, FIXTURE_ENTRIES.length);
  });

  test("count of 0 or an empty pool returns an empty array", () => {
    assert.deepEqual(selectReviewWords(FIXTURE_ENTRIES, FIXTURE_PROGRESS, 0, { now: NOW }), []);
    assert.deepEqual(selectReviewWords([], FIXTURE_PROGRESS, 5, { now: NOW }), []);
  });

  test("custom weights override DEFAULT_WEIGHTS without mutating it", () => {
    const entries = [entry("new-word"), entry("mastered-word")];
    const wins = { "new-word": 0, "mastered-word": 0 };

    for (let i = 0; i < 2000; i++) {
      const [picked] = selectReviewWords(entries, FIXTURE_PROGRESS, 1, {
        now: NOW,
        weights: { new: 0.1, mastered: 10 }
      });
      wins[picked.id] += 1;
    }

    assert.ok(wins["mastered-word"] > wins["new-word"]);
    assert.equal(DEFAULT_WEIGHTS.new, 1, "DEFAULT_WEIGHTS must not be mutated by the override");
    assert.equal(DEFAULT_WEIGHTS.mastered, 0.5);
  });
});
