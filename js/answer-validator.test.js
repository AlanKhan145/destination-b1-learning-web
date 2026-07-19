import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateMultipleChoice, validateShortAnswer, validateTrueFalse, validateAnswer } from "./answer-validator.js";

const mcQuestion = {
  id: "unit-1-present-simple-mcq-0001",
  type: "multiple-choice",
  correctOptionIds: ["b"],
  selectionMode: "single",
  explanation: "because"
};

const mcMultiQuestion = {
  id: "unit-1-x-mcq-0002",
  type: "multiple-choice",
  correctOptionIds: ["a", "c"],
  selectionMode: "multiple",
  explanation: "because"
};

describe("validateMultipleChoice", () => {
  test("selecting the correct single option is correct", () => {
    const result = validateMultipleChoice(mcQuestion, ["b"]);
    assert.equal(result.isCorrect, true);
    assert.equal(result.score, 1);
  });

  test("selecting the wrong option is incorrect", () => {
    const result = validateMultipleChoice(mcQuestion, ["a"]);
    assert.equal(result.isCorrect, false);
    assert.equal(result.score, 0);
  });

  test("no selection is incorrect, not a crash", () => {
    const result = validateMultipleChoice(mcQuestion, []);
    assert.equal(result.isCorrect, false);
    assert.deepEqual(result.userAnswer, []);
  });

  test("option order does not affect correctness (shuffle-safe)", () => {
    const result = validateMultipleChoice(mcMultiQuestion, ["c", "a"]);
    assert.equal(result.isCorrect, true);
  });

  test("multi-answer question requires every correct option, no extras", () => {
    assert.equal(validateMultipleChoice(mcMultiQuestion, ["a"]).isCorrect, false);
    assert.equal(validateMultipleChoice(mcMultiQuestion, ["a", "c", "b"]).isCorrect, false);
  });
});

const shortQuestion = {
  id: "unit-1-present-continuous-short-0001",
  type: "short-answer",
  acceptedAnswers: ["is writing", "Gordon is writing", "I'm writing"],
  answerValidation: {
    caseSensitive: false,
    trimWhitespace: true,
    collapseWhitespace: true,
    ignoreEndingPunctuation: true,
    matchMode: "normalized"
  },
  explanation: "because"
};

describe("validateShortAnswer", () => {
  test("exact accepted answer is correct", () => {
    assert.equal(validateShortAnswer(shortQuestion, "is writing").isCorrect, true);
  });

  test("different case is still correct (caseSensitive: false)", () => {
    assert.equal(validateShortAnswer(shortQuestion, "IS WRITING").isCorrect, true);
  });

  test("extra surrounding/internal whitespace is normalized away", () => {
    assert.equal(validateShortAnswer(shortQuestion, "  is    writing  ").isCorrect, true);
  });

  test("trailing punctuation is ignored", () => {
    assert.equal(validateShortAnswer(shortQuestion, "is writing.").isCorrect, true);
  });

  test("contraction form in acceptedAnswers matches", () => {
    assert.equal(validateShortAnswer(shortQuestion, "I'm writing").isCorrect, true);
  });

  test("an answer outside acceptedAnswers is incorrect", () => {
    assert.equal(validateShortAnswer(shortQuestion, "writes").isCorrect, false);
  });

  test("empty answer is incorrect, not a crash", () => {
    assert.equal(validateShortAnswer(shortQuestion, "").isCorrect, false);
    assert.equal(validateShortAnswer(shortQuestion, undefined).isCorrect, false);
  });
});

const tfQuestion = {
  id: "unit-1-present-simple-tf-0001",
  type: "true-false",
  correctAnswer: true,
  explanation: "because"
};

describe("validateTrueFalse", () => {
  test("choosing true when correctAnswer is true is correct", () => {
    assert.equal(validateTrueFalse(tfQuestion, true).isCorrect, true);
  });

  test("choosing false when correctAnswer is true is incorrect", () => {
    assert.equal(validateTrueFalse(tfQuestion, false).isCorrect, false);
  });

  test("no answer is incorrect, not a crash", () => {
    const result = validateTrueFalse(tfQuestion, null);
    assert.equal(result.isCorrect, false);
    assert.equal(result.userAnswer, null);
  });

  test("the string 'true' is never treated as the boolean true", () => {
    // Guards against a common bug: JSON round-tripping or a careless renderer
    // producing the string "true" instead of the boolean true.
    assert.equal(validateTrueFalse(tfQuestion, "true").isCorrect, false);
  });
});

describe("validateAnswer dispatcher", () => {
  test("routes to the validator matching question.type", () => {
    assert.equal(validateAnswer(mcQuestion, ["b"]).isCorrect, true);
    assert.equal(validateAnswer(tfQuestion, true).isCorrect, true);
    assert.equal(validateAnswer(shortQuestion, "is writing").isCorrect, true);
  });

  test("throws for an unregistered type instead of silently passing", () => {
    assert.throws(() => validateAnswer({ type: "not-a-real-type" }, {}));
  });
});
