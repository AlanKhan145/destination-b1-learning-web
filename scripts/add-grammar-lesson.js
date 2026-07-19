#!/usr/bin/env node
// Scaffolds a new Grammar lesson branch (same shape as data/lessons/unit-4.json):
//   1. data/lessons/unit-N.json          — lesson file with one skeleton per topic
//   2. data/lessons/index.json           — new entry inserted in unit order
//   3. neighbour lessons                 — previous/next ids re-linked
//   4. data/reviews/unit-N-review.json   — review shell (fill questionIds later)
//   5. data/question-bank/unit-N/<topic> — empty folders ready for questions
//
// Usage:
//   node scripts/add-grammar-lesson.js --unit 5 --title "Past perfect" \
//     --description "Learn the past perfect." \
//     --topics "Past perfect simple; Past perfect continuous"
//
// Options:
//   --unit <n>          (required) unit number, e.g. 5 -> unit-5
//   --title <text>      (required) lesson title
//   --description <t>   lesson description (defaults to "Learn how to use <title>.")
//   --topics <list>     topic titles separated by ";" (or "," when no ";" present);
//                       ids are auto-slugged. Default: one topic named after the title.
//   --template <id>     clone topics/content from an existing lesson (e.g. unit-4)
//                       instead of the empty skeleton; ids are rewritten to the new unit.
//   --prev <id>         previous lesson id (default: unit-(N-1) if that file exists)
//   --next <id>         next lesson id (default: unit-(N+1) if that file exists)
//   --no-review         skip the data/reviews scaffold
//   --no-bank           skip the data/question-bank folders
//   --force             overwrite an existing lesson file
//   --dry-run           print what would be written without touching disk
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT, LESSONS_DIR, REVIEWS_DIR, QUESTION_BANK_DIR } from "./lib/question-bank.js";

function parseArgs(argv) {
  const args = { review: true, bank: true, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) fail(`Missing value for ${flag}`);
      return argv[i];
    };
    switch (flag) {
      case "--unit": args.unit = Number(next()); break;
      case "--title": args.title = next(); break;
      case "--description": args.description = next(); break;
      case "--topics": args.topics = next(); break;
      case "--template": args.template = next(); break;
      case "--prev": args.prev = next(); break;
      case "--next": args.next = next(); break;
      case "--no-review": args.review = false; break;
      case "--no-bank": args.bank = false; break;
      case "--force": args.force = true; break;
      case "--dry-run": args.dryRun = true; break;
      case "--help": case "-h": printUsage(); process.exit(0); break;
      default: fail(`Unknown option: ${flag}`);
    }
  }
  return args;
}

function printUsage() {
  console.log('Usage: node scripts/add-grammar-lesson.js --unit 5 --title "Past perfect" [--topics "A; B"] [--template unit-4] [--dry-run]');
}

function fail(message) {
  console.error(`Error: ${message}`);
  printUsage();
  process.exit(1);
}

// "Present perfect simple" -> "present-perfect-simple" (diacritics stripped so Vietnamese titles work too)
function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTopics(raw, fallbackTitle) {
  const source = raw?.trim() ? raw : fallbackTitle;
  const separator = source.includes(";") ? ";" : ",";
  const titles = source.split(separator).map((t) => t.trim()).filter(Boolean);
  if (!titles.length) fail("--topics produced no topic titles");
  const topics = titles.map((title) => ({ title, id: slugify(title) }));
  const ids = new Set(topics.map((t) => t.id));
  if (ids.size !== topics.length) fail("Topic titles produce duplicate ids — make them distinct");
  return topics;
}

async function fileExists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function toJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// One topic skeleton, same shape as the unit-4 topics (forms table, uses, notes).
function buildTopicSkeleton(lessonId, topic, number) {
  return {
    id: topic.id,
    number,
    title: topic.title,
    status: "available",
    review: {
      enabled: true,
      questionFilter: { unitId: lessonId, topicIds: [topic.id], status: ["published"] }
    },
    description: "TODO: when is this form used?",
    formula: "TODO: e.g. have/has + past participle",
    forms: {
      columns: ["I / you / we / they", "He / she / it"],
      rows: [
        { label: "Statement", cells: ["TODO", "TODO"] },
        { label: "Negative", cells: ["TODO", "TODO"] },
        { label: "Question", cells: ["TODO", "TODO"] }
      ]
    },
    uses: [
      { usage: "TODO: main use", example: "TODO: example sentence.", highlightWords: [] }
    ],
    notes: [
      { type: "helpful-hint", content: "TODO: common time words / signal phrases.", examples: [], highlightWords: [] }
    ]
  };
}

// Rewrites a cloned topic (from --template) so every reference points at the new unit.
function retargetTopic(topic, lessonId, number) {
  const clone = structuredClone(topic);
  clone.number = number;
  if (clone.review?.questionFilter) {
    clone.review.questionFilter.unitId = lessonId;
    clone.review.questionFilter.topicIds = [clone.id];
  }
  return clone;
}

function buildLesson({ lessonId, unit, title, description, previousLessonId, nextLessonId, topics }) {
  return {
    id: lessonId,
    unitNumber: unit,
    category: "Grammar",
    title,
    description,
    previousLessonId,
    nextLessonId,
    review: {
      reviewId: `${lessonId}-review`,
      enabled: true,
      displayMode: "side-panel",
      position: "right",
      defaultOpen: false
    },
    topics
  };
}

function buildReviewShell(lessonId, unit, title, topics) {
  const sectionTypes = [
    { type: "multiple-choice", title: "Multiple choice", instructions: "Choose the correct answer.", shuffleOptions: true },
    { type: "short-answer", title: "Short answer", instructions: "Complete each sentence with the correct form of the verb in brackets." },
    { type: "true-false", title: "True or false", instructions: "Decide whether each statement is true or false." }
  ];
  return {
    id: `${lessonId}-review`,
    unitId: lessonId,
    title: `Unit ${unit} Review`,
    description: `Review: ${title}.`,
    passingScore: 70,
    contentLocale: "en",
    attemptSettings: {
      allowRetry: true,
      showCorrectAnswer: "after-submit",
      showExplanation: "after-submit",
      saveProgress: true
    },
    sections: sectionTypes.map(({ type, title: sectionTitle, instructions, shuffleOptions }) => ({
      id: type,
      type,
      title: sectionTitle,
      instructions,
      selectionMode: "fixed",
      shuffleQuestions: true,
      ...(shuffleOptions ? { shuffleOptions: true } : {}),
      questionIds: []
    }))
  };
}

// Inserts the new entry right after its previous lesson (or in unit order, or at the end).
function upsertIndexEntry(index, entry, previousLessonId) {
  const lessons = index.lessons.filter((l) => l.id !== entry.id);
  const prevPosition = lessons.findIndex((l) => l.id === previousLessonId);
  if (prevPosition !== -1) {
    lessons.splice(prevPosition + 1, 0, entry);
  } else {
    const later = lessons.findIndex((l) => typeof l.unitNumber === "number" && l.unitNumber > entry.unitNumber);
    if (later !== -1) lessons.splice(later, 0, entry);
    else lessons.push(entry);
  }
  return { ...index, lessons };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Number.isInteger(args.unit) || args.unit < 1) fail("--unit must be a positive integer");
  if (!args.title?.trim()) fail("--title is required");

  const unit = args.unit;
  const lessonId = `unit-${unit}`;
  const title = args.title.trim();
  const description = args.description?.trim() || `Learn how to use ${title.toLowerCase()}.`;
  const lessonPath = path.join(LESSONS_DIR, `${lessonId}.json`);
  const indexPath = path.join(LESSONS_DIR, "index.json");
  const reviewPath = path.join(REVIEWS_DIR, `${lessonId}-review.json`);

  if (!args.force && (await fileExists(lessonPath))) {
    fail(`${path.relative(PROJECT_ROOT, lessonPath)} already exists (use --force to overwrite)`);
  }

  // Topics: cloned from --template, or empty skeletons from --topics/--title.
  let topics;
  if (args.template) {
    const templatePath = path.join(LESSONS_DIR, `${args.template}.json`);
    if (!(await fileExists(templatePath))) fail(`Template lesson not found: ${path.relative(PROJECT_ROOT, templatePath)}`);
    const template = await readJson(templatePath);
    topics = (template.topics ?? []).map((topic, i) => retargetTopic(topic, lessonId, i + 1));
    if (!topics.length) fail(`Template ${args.template} has no topics`);
  } else {
    topics = parseTopics(args.topics, title).map((topic, i) => buildTopicSkeleton(lessonId, topic, i + 1));
  }

  // Neighbours: default to unit-(N±1) when those files exist.
  const defaultPrev = `unit-${unit - 1}`;
  const defaultNext = `unit-${unit + 1}`;
  const previousLessonId = args.prev ?? ((await fileExists(path.join(LESSONS_DIR, `${defaultPrev}.json`))) ? defaultPrev : null);
  const nextLessonId = args.next ?? ((await fileExists(path.join(LESSONS_DIR, `${defaultNext}.json`))) ? defaultNext : null);

  const lesson = buildLesson({ lessonId, unit, title, description, previousLessonId, nextLessonId, topics });

  const index = await readJson(indexPath);
  const updatedIndex = upsertIndexEntry(index, {
    id: lessonId,
    unitNumber: unit,
    category: "Grammar",
    title,
    description,
    status: "available"
  }, previousLessonId);

  // Plan every write first so --dry-run can report without side effects.
  const writes = [
    { path: lessonPath, content: toJson(lesson) },
    { path: indexPath, content: toJson(updatedIndex) }
  ];

  for (const [neighbourId, field] of [[previousLessonId, "nextLessonId"], [nextLessonId, "previousLessonId"]]) {
    if (!neighbourId) continue;
    const neighbourPath = path.join(LESSONS_DIR, `${neighbourId}.json`);
    if (!(await fileExists(neighbourPath))) continue;
    const neighbour = await readJson(neighbourPath);
    if (neighbour[field] !== lessonId) {
      neighbour[field] = lessonId;
      writes.push({ path: neighbourPath, content: toJson(neighbour) });
    }
  }

  if (args.review && !(await fileExists(reviewPath))) {
    writes.push({ path: reviewPath, content: toJson(buildReviewShell(lessonId, unit, title, topics)) });
  }

  const bankDirs = args.bank
    ? topics.map((topic) => path.join(QUESTION_BANK_DIR, lessonId, topic.id))
    : [];

  if (args.dryRun) {
    console.log("Dry run — nothing written. Planned changes:");
    for (const write of writes) console.log(`  write  ${path.relative(PROJECT_ROOT, write.path)}`);
    for (const dir of bankDirs) console.log(`  mkdir  ${path.relative(PROJECT_ROOT, dir)}`);
    return;
  }

  for (const write of writes) {
    await writeFile(write.path, write.content, "utf8");
    console.log(`Wrote  ${path.relative(PROJECT_ROOT, write.path)}`);
  }
  for (const dir of bankDirs) {
    await mkdir(dir, { recursive: true });
    console.log(`Mkdir  ${path.relative(PROJECT_ROOT, dir)}`);
  }

  console.log(`\nDone: ${lessonId} — "${title}" (${topics.length} topic${topics.length > 1 ? "s" : ""})`);
  console.log("Next steps:");
  console.log(`  1. Fill in the TODO fields in data/lessons/${lessonId}.json`);
  console.log(`  2. Author questions under data/question-bank/${lessonId}/<topic>/`);
  console.log(`  3. List their ids in data/reviews/${lessonId}-review.json`);
  console.log("  4. Run: npm run build:data");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
