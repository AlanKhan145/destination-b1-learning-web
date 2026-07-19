import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeScore } from "./score-calculator.js";

const review = { id: "unit-1-review", passingScore: 70 };

function entry(topicId, type, isCorrect, answered = true) {
  return {
    question: { topicId, type },
    result: answered ? { isCorrect } : null
  };
}

describe("computeScore", () => {
  test("computes totals and percentage", () => {
    const score = computeScore(review, [
      entry("present-simple", "multiple-choice", true),
      entry("present-simple", "multiple-choice", false),
      entry("present-continuous", "short-answer", true),
      entry("present-continuous", "short-answer", true)
    ]);

    assert.equal(score.totalQuestions, 4);
    assert.equal(score.answeredQuestions, 4);
    assert.equal(score.correctQuestions, 3);
    assert.equal(score.scorePercent, 75);
    assert.equal(score.passed, true);
  });

  test("fails when score is below passingScore", () => {
    const score = computeScore(review, [entry("present-simple", "multiple-choice", true), entry("present-simple", "multiple-choice", false)]);
    assert.equal(score.scorePercent, 50);
    assert.equal(score.passed, false);
  });

  test("unanswered questions count toward the total but not answeredQuestions", () => {
    const score = computeScore(review, [entry("present-simple", "multiple-choice", true), entry("present-simple", "multiple-choice", false, false)]);
    assert.equal(score.totalQuestions, 2);
    assert.equal(score.answeredQuestions, 1);
  });

  test("breaks down correctness by topic and by type", () => {
    const score = computeScore(review, [
      entry("present-simple", "multiple-choice", true),
      entry("present-simple", "short-answer", false),
      entry("stative-verbs", "true-false", true)
    ]);

    assert.deepEqual(score.byTopic["present-simple"], { correct: 1, total: 2 });
    assert.deepEqual(score.byTopic["stative-verbs"], { correct: 1, total: 1 });
    assert.deepEqual(score.byType["multiple-choice"], { correct: 1, total: 1 });
    assert.deepEqual(score.byType["short-answer"], { correct: 0, total: 1 });
  });

  test("an empty review scores 0% without dividing by zero", () => {
    const score = computeScore(review, []);
    assert.equal(score.scorePercent, 0);
    assert.equal(score.totalQuestions, 0);
  });
});
