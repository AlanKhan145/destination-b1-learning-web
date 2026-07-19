import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { gradeTyped } from "./vocabulary-grader.js";

describe("gradeTyped", () => {
  test("accepts an exact match", () => {
    assert.equal(gradeTyped("beat", "beat"), true);
  });

  test("is case-insensitive and forgives surrounding whitespace", () => {
    assert.equal(gradeTyped("  BEAT  ", "beat"), true);
  });

  test("collapses internal double spaces", () => {
    assert.equal(gradeTyped("board   game", "board game"), true);
  });

  test("ignores a trailing period", () => {
    assert.equal(gradeTyped("beat.", "beat"), true);
  });

  test("rejects a genuine misspelling — no fuzzy matching", () => {
    assert.equal(gradeTyped("beet", "beat"), false);
  });

  test("rejects an empty answer", () => {
    assert.equal(gradeTyped("", "beat"), false);
    assert.equal(gradeTyped("   ", "beat"), false);
  });

  test("accepts a configured variant spelling", () => {
    assert.equal(gradeTyped("in the middle", "in the middle of", ["in the middle"]), true);
  });

  test("rejects an unconfigured variant", () => {
    assert.equal(gradeTyped("in the center", "in the middle of", ["in the middle"]), false);
  });
});
