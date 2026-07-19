#!/usr/bin/env node
// Validates the entire question bank: JSON syntax, per-type schema rules, duplicate ids,
// filename/id consistency, unitId/topicId existence, and review -> question references.
// Run with: npm run validate:questions
import path from "node:path";
import { loadQuestionFiles, loadLessons, loadReviews, QUESTION_BANK_DIR } from "./lib/question-bank.js";
import { validateQuestion } from "./lib/question-rules.js";

function log(problems) {
  for (const problem of problems) console.error(`  - ${problem}`);
}

async function main() {
  const [entries, lessons, reviews] = await Promise.all([loadQuestionFiles(), loadLessons(), loadReviews()]);

  const unitTopics = new Map(); // unitId -> Set(topicId)
  for (const lesson of lessons) {
    unitTopics.set(lesson.id, new Set((lesson.topics || []).map((topic) => topic.id)));
  }

  let errorCount = 0;
  const idToFile = new Map();
  const questionById = new Map();

  for (const { relPath, absPath, question, parseError } of entries) {
    if (parseError) {
      console.error(`\n${relPath}`);
      log([`invalid JSON: ${parseError}`]);
      errorCount++;
      continue;
    }

    const fileErrors = [];

    const expectedBaseName = `${question.id}.json`;
    const actualBaseName = path.basename(absPath);
    if (question.id && actualBaseName !== expectedBaseName) {
      fileErrors.push(`filename "${actualBaseName}" does not match id "${question.id}" (expected "${expectedBaseName}")`);
    }

    if (question.id) {
      if (idToFile.has(question.id)) {
        fileErrors.push(`duplicate id "${question.id}" (also used by ${idToFile.get(question.id)})`);
      } else {
        idToFile.set(question.id, relPath);
        questionById.set(question.id, question);
      }
    }

    if (question.unitId && !unitTopics.has(question.unitId)) {
      fileErrors.push(`unitId "${question.unitId}" does not exist in data/lessons`);
    } else if (question.unitId && question.topicId && !unitTopics.get(question.unitId).has(question.topicId)) {
      fileErrors.push(`topicId "${question.topicId}" does not exist under ${question.unitId}`);
    }

    const expectedDirPrefix = question.unitId && question.topicId ? path.join(question.unitId, question.topicId) : null;
    if (expectedDirPrefix && !path.dirname(relPath).startsWith(expectedDirPrefix.split(path.sep).join("/"))) {
      fileErrors.push(`file lives at "${relPath}" but unitId/topicId suggest it should be under "${expectedDirPrefix}/"`);
    }

    fileErrors.push(...validateQuestion(question));

    if (fileErrors.length) {
      console.error(`\n${relPath}`);
      log(fileErrors);
      errorCount += fileErrors.length;
    }
  }

  // Review -> question reference checks.
  for (const { file, review } of reviews) {
    const reviewErrors = [];

    if (review.unitId && !unitTopics.has(review.unitId)) {
      reviewErrors.push(`unitId "${review.unitId}" does not exist in data/lessons`);
    }

    for (const section of review.sections || []) {
      if (section.selectionMode === "fixed") {
        for (const questionId of section.questionIds || []) {
          const question = questionById.get(questionId);
          if (!question) {
            reviewErrors.push(`section "${section.id}" references unknown questionId "${questionId}"`);
            continue;
          }
          if (question.status !== "published") {
            reviewErrors.push(`section "${section.id}" references "${questionId}" which is not published (status: ${question.status})`);
          }
          if (section.type !== "mixed" && question.type !== section.type) {
            reviewErrors.push(`section "${section.id}" has type "${section.type}" but question "${questionId}" has type "${question.type}"`);
          }
        }
      } else if (section.selectionMode === "random") {
        if (!section.questionFilter) reviewErrors.push(`section "${section.id}" uses random selection but has no questionFilter`);
        if (!section.questionCount) reviewErrors.push(`section "${section.id}" uses random selection but has no questionCount`);
      } else {
        reviewErrors.push(`section "${section.id}" has invalid selectionMode "${section.selectionMode}"`);
      }
    }

    if (reviewErrors.length) {
      console.error(`\ndata/reviews/${file}`);
      log(reviewErrors);
      errorCount += reviewErrors.length;
    }
  }

  console.log(`\nChecked ${entries.length} question file(s) and ${reviews.length} review file(s) under ${path.relative(process.cwd(), QUESTION_BANK_DIR)}.`);

  if (errorCount > 0) {
    console.error(`\n${errorCount} problem(s) found. Fix them before building the index.`);
    process.exit(1);
  }

  console.log("Question bank is valid.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
