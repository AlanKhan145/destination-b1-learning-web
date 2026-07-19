// Shared filesystem helpers for the question-bank tooling (validate + build-index scripts).
// Kept dependency-free (no ajv, no glob) since the project has no build step or installed packages.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
export const QUESTION_BANK_DIR = path.join(PROJECT_ROOT, "data", "question-bank");
export const LESSONS_DIR = path.join(PROJECT_ROOT, "data", "lessons");
export const REVIEWS_DIR = path.join(PROJECT_ROOT, "data", "reviews");
export const MANIFESTS_DIR = path.join(QUESTION_BANK_DIR, "manifests");

const SKIP_ENTRIES = new Set(["manifests", "index.json"]);

/**
 * Recursively finds every *.json file under data/question-bank, skipping
 * index.json and the manifests/ directory (those are generated output, not source questions).
 */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (dir === QUESTION_BANK_DIR && SKIP_ENTRIES.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function findQuestionFiles() {
  return walk(QUESTION_BANK_DIR);
}

/**
 * Reads and JSON-parses every question file. Parse failures are collected
 * rather than thrown, so one bad file doesn't stop the whole scan.
 */
export async function loadQuestionFiles() {
  const files = await findQuestionFiles();
  const results = [];

  for (const absPath of files) {
    const relPath = path.relative(QUESTION_BANK_DIR, absPath).split(path.sep).join("/");
    try {
      const raw = await readFile(absPath, "utf8");
      const question = JSON.parse(raw);
      results.push({ absPath, relPath, question, parseError: null });
    } catch (error) {
      results.push({ absPath, relPath, question: null, parseError: error.message });
    }
  }

  return results;
}

export async function loadLessons() {
  const entries = await readdir(LESSONS_DIR, { withFileTypes: true });
  const lessons = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const raw = await readFile(path.join(LESSONS_DIR, entry.name), "utf8");
    lessons.push(JSON.parse(raw));
  }

  return lessons;
}

export async function loadReviews() {
  let entries;
  try {
    entries = await readdir(REVIEWS_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const reviews = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.endsWith(".legacy.json")) continue;
    const raw = await readFile(path.join(REVIEWS_DIR, entry.name), "utf8");
    reviews.push({ file: entry.name, review: JSON.parse(raw) });
  }

  return reviews;
}
