#!/usr/bin/env node
// Scans data/question-bank and generates index.json plus one manifest per unit.
// Refuses to write anything if the bank doesn't pass validation first.
// Run with: npm run build:question-index (or npm run build:data to validate + build)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadQuestionFiles, QUESTION_BANK_DIR, MANIFESTS_DIR } from "./lib/question-bank.js";
import { validateQuestion } from "./lib/question-rules.js";

async function main() {
  const entries = await loadQuestionFiles();

  const seenIds = new Set();
  const indexQuestions = [];
  const byUnit = new Map(); // unitId -> array of questionIds (sorted by id at the end)

  for (const { relPath, question, parseError } of entries) {
    if (parseError) {
      console.error(`Refusing to build index: ${relPath} has invalid JSON (${parseError}). Run npm run validate:questions.`);
      process.exit(1);
    }

    const errors = validateQuestion(question);
    if (errors.length) {
      console.error(`Refusing to build index: ${relPath} failed validation. Run npm run validate:questions for details.`);
      process.exit(1);
    }

    if (seenIds.has(question.id)) {
      console.error(`Refusing to build index: duplicate id "${question.id}" (${relPath}).`);
      process.exit(1);
    }
    seenIds.add(question.id);

    indexQuestions.push({
      id: question.id,
      type: question.type,
      unitId: question.unitId,
      topicId: question.topicId,
      difficulty: question.difficulty,
      status: question.status,
      path: relPath
    });

    if (!byUnit.has(question.unitId)) byUnit.set(question.unitId, []);
    byUnit.get(question.unitId).push(question.id);
  }

  indexQuestions.sort((a, b) => a.id.localeCompare(b.id));

  const generatedAt = new Date().toISOString();
  const index = {
    version: 1,
    generatedAt,
    totalQuestions: indexQuestions.length,
    questions: indexQuestions
  };

  await writeFile(path.join(QUESTION_BANK_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(`Wrote index.json with ${indexQuestions.length} question(s).`);

  await mkdir(MANIFESTS_DIR, { recursive: true });
  for (const [unitId, questionIds] of byUnit) {
    questionIds.sort((a, b) => a.localeCompare(b));
    const manifest = { unitId, totalQuestions: questionIds.length, questionIds };
    await writeFile(path.join(MANIFESTS_DIR, `${unitId}.json`), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`Wrote manifests/${unitId}.json with ${questionIds.length} question(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
