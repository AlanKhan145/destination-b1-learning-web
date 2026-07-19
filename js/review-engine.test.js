import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startStaticServer, withRelativeFetch, withMemoryLocalStorage } from "./test-helpers/static-server.js";
import {
  loadReview,
  createTopicPracticeReview,
  startReviewAttempt,
  getCurrentEntry,
  goToIndex,
  goToNext,
  recordAnswer,
  submitCurrentAnswer,
  isComplete,
  finishAttempt
} from "./review-engine.js";

let server;
let restoreFetch;
let restoreLocalStorage;

before(async () => {
  server = await startStaticServer();
  restoreFetch = withRelativeFetch(server.url);
  restoreLocalStorage = withMemoryLocalStorage();
});

after(async () => {
  restoreFetch();
  restoreLocalStorage();
  await server.close();
});

describe("loadReview + startReviewAttempt (fixed sections)", () => {
  test("resolves unit-1-review.json into ordered question entries", async () => {
    const review = await loadReview("unit-1-review");
    const attempt = await startReviewAttempt(review);

    // 9 mcq + 6 short-answer + 6 true-false (fixed) + 9 random (mixed-practice, from the remaining spare questions)
    assert.equal(attempt.entries.length, 30);
    assert.equal(attempt.loadErrors.length, 0);
    assert.ok(attempt.entries.every((entry) => entry.question && entry.question.id === entry.questionId));
  });

  test("rejects an unknown review id", async () => {
    await assert.rejects(loadReview("does-not-exist"), /review-not-found/);
  });
});

describe("answering flow", () => {
  test("record -> submit -> next walks through questions and grades them", async () => {
    const review = await loadReview("unit-1-review");
    const attempt = await startReviewAttempt(review);

    const first = getCurrentEntry(attempt);
    const correctAnswer =
      first.question.type === "true-false"
        ? first.question.correctAnswer
        : first.question.type === "multiple-choice"
        ? first.question.correctOptionIds
        : first.question.acceptedAnswers[0];

    recordAnswer(attempt, correctAnswer);
    const result = submitCurrentAnswer(attempt);

    assert.equal(result.isCorrect, true);
    assert.equal(first.result.isCorrect, true);

    goToNext(attempt);
    assert.notEqual(getCurrentEntry(attempt), first);
  });

  test("reload (spec section 23): a second startReviewAttempt() resumes the saved answer", async () => {
    const review = await loadReview("unit-1-review");

    // First "page load": answer question 0, but never finish the review.
    const original = await startReviewAttempt(review);
    const entry = getCurrentEntry(original);
    const answer =
      entry.question.type === "true-false"
        ? entry.question.correctAnswer
        : entry.question.type === "multiple-choice"
        ? entry.question.correctOptionIds
        : entry.question.acceptedAnswers[0];
    recordAnswer(original, answer);
    submitCurrentAnswer(original);

    // Simulated page reload: same review, new call. Should resume, not start over.
    const resumed = await startReviewAttempt(review);
    assert.equal(resumed.attemptId, original.attemptId);
    assert.equal(resumed.entries[0].questionId, original.entries[0].questionId);
    assert.equal(resumed.entries[0].result?.isCorrect, true);
    assert.notEqual(resumed.entries[0].answer, null);
  });

  test("finishAttempt scores every question once all are answered", async () => {
    const review = await loadReview("unit-1-review");
    const attempt = await startReviewAttempt(review);

    // Answer everything incorrectly on purpose so scorePercent is deterministic (0%).
    for (let i = 0; i < attempt.entries.length; i++) {
      goToIndex(attempt, i);
      const entry = attempt.entries[i];
      const wrongAnswer =
        entry.question.type === "true-false"
          ? !entry.question.correctAnswer
          : entry.question.type === "multiple-choice"
          ? entry.question.options.map((o) => o.id).filter((id) => !entry.question.correctOptionIds.includes(id)).slice(0, 1)
          : "definitely not an accepted answer";
      recordAnswer(attempt, wrongAnswer);
      submitCurrentAnswer(attempt);
    }

    assert.equal(isComplete(attempt), true);
    const score = finishAttempt(attempt);
    assert.equal(score.totalQuestions, attempt.entries.length);
    assert.equal(score.correctQuestions, 0);
    assert.equal(score.scorePercent, 0);
    assert.equal(score.passed, false);
  });
});

describe("createTopicPracticeReview (spec section 18: no review file needed)", () => {
  test("builds an ephemeral review scoped to one topic", async () => {
    const review = createTopicPracticeReview("unit-1", "present-continuous", 6);
    const attempt = await startReviewAttempt(review);

    assert.equal(attempt.entries.length, 6);
    assert.ok(attempt.entries.every((entry) => entry.question.topicId === "present-continuous"));
  });
});
