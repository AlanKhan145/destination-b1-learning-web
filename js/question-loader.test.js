import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startStaticServer, withRelativeFetch } from "./test-helpers/static-server.js";
import {
  getQuestionById,
  getQuestionsByIds,
  getQuestionsByFilter,
  getRandomQuestions,
  getQuestionsByUnit,
  getQuestionsByTopic
} from "./question-loader.js";

let server;
let restoreFetch;

before(async () => {
  server = await startStaticServer();
  restoreFetch = withRelativeFetch(server.url);
});

after(async () => {
  restoreFetch();
  await server.close();
});

describe("getQuestionById", () => {
  test("loads a real question by id", async () => {
    const question = await getQuestionById("unit-1-present-simple-mcq-0001");
    assert.equal(question.id, "unit-1-present-simple-mcq-0001");
    assert.equal(question.type, "multiple-choice");
  });

  test("rejects with QUESTION_NOT_FOUND for an unknown id", async () => {
    await assert.rejects(getQuestionById("unit-1-does-not-exist-mcq-9999"), /QUESTION_NOT_FOUND/);
  });

  test("caches: repeated calls return the same object", async () => {
    const a = await getQuestionById("unit-1-present-simple-tf-0001");
    const b = await getQuestionById("unit-1-present-simple-tf-0001");
    assert.equal(a, b);
  });
});

describe("getQuestionsByIds", () => {
  test("skips missing questions instead of failing the whole batch", async () => {
    const { questions, errors } = await getQuestionsByIds([
      "unit-1-present-simple-mcq-0001",
      "unit-1-does-not-exist-mcq-9999",
      "unit-1-present-simple-tf-0001"
    ]);

    assert.equal(questions.length, 2);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].questionId, "unit-1-does-not-exist-mcq-9999");
  });
});

describe("getQuestionsByFilter / getQuestionsByTopic / getQuestionsByUnit", () => {
  test("filters by topic return only that topic's published questions", async () => {
    const { questions } = await getQuestionsByTopic("unit-1", "present-simple");
    assert.equal(questions.length, 10); // 4 mcq + 3 short-answer + 3 true-false, seeded
    assert.ok(questions.every((q) => q.topicId === "present-simple" && q.status === "published"));
  });

  test("filters by type narrow within a topic", async () => {
    const { questions } = await getQuestionsByFilter({ unitId: "unit-1", topicId: "present-continuous", type: "short-answer" });
    assert.equal(questions.length, 3);
    assert.ok(questions.every((q) => q.type === "short-answer"));
  });

  test("getQuestionsByUnit returns every published question in the unit", async () => {
    const { questions } = await getQuestionsByUnit("unit-1");
    assert.equal(questions.length, 30);
  });
});

describe("getRandomQuestions", () => {
  test("returns the requested count with no duplicates", async () => {
    const { questions } = await getRandomQuestions({ unitId: "unit-1" }, 12);
    assert.equal(questions.length, 12);
    assert.equal(new Set(questions.map((q) => q.id)).size, 12);
  });

  test("honors a per-type distribution", async () => {
    const { questions } = await getRandomQuestions(
      { unitId: "unit-1", status: ["published"] },
      undefined,
      { distribution: { "multiple-choice": 5, "true-false": 3 } }
    );
    const byType = questions.reduce((acc, q) => ({ ...acc, [q.type]: (acc[q.type] || 0) + 1 }), {});
    assert.equal(byType["multiple-choice"], 5);
    assert.equal(byType["true-false"], 3);
  });

  test("never selects an id passed in avoidIds", async () => {
    const { questions: first } = await getRandomQuestions({ unitId: "unit-1", topicId: "stative-verbs" }, 10);
    const avoidIds = first.map((q) => q.id);
    const { questions: second } = await getRandomQuestions({ unitId: "unit-1", topicId: "stative-verbs" }, 5, { avoidIds });
    assert.equal(second.length, 0); // only 10 stative-verbs questions exist, all excluded
  });
});
