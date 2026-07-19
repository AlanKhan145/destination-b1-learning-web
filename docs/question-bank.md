# Question bank

How Destination B1 Learning Web stores, serves, and grades review questions.
This replaces the old approach of embedding a whole unit's questions inside a
single `unit-1-review.json` array.

## Architecture

```
Lesson content (data/lessons/*.json)
      │  topicId, review.questionFilter
      ▼
Question bank (data/question-bank/**/*.json)
      │  questionId
      ▼
Review configuration (data/reviews/*.json)
```

- **Lesson content** never contains question text. A topic only declares which
  questions it's linked to, via a filter (`unitId` + `topicId`).
- **Question bank** is one JSON file per question. Nothing else knows a
  question's file path except `index.json` / the per-unit manifests.
- **Review configuration** never embeds question content — a section is either
  `"selectionMode": "fixed"` (an explicit `questionIds` list) or
  `"selectionMode": "random"` (a `questionFilter` + `questionCount`).
- The UI (`js/review-panel.js`) only ever calls `js/question-loader.js` and
  `js/review-engine.js`. It never constructs a `data/question-bank/...` path
  itself, and it never special-cases a unit or topic id.

A question can be referenced by any number of reviews — `unit-1-review.json`,
a future "Final course review", a topic-practice session — without ever being
copied. Only the id is shared.

## Loading strategy (don't fetch the whole bank)

```
Open lesson → fetch lesson JSON → fetch review config → read questionIds /
questionFilter → fetch the relevant manifest/index entries → fetch only the
questions actually used in this attempt.
```

`js/question-loader.js` fetches `data/question-bank/index.json` once (cached
in memory for the page's lifetime) to resolve id → file path, then fetches
individual question files lazily and caches them by id
(`questionCache: Map<id, Promise<question>>`). A 20-question review fetches
~21 files total (1 index + 20 questions), never the whole bank.

## ID rules

```
unit-{unitNumber}-{topicId}-{questionType}-{0001}
```

Examples: `unit-1-present-simple-mcq-0001`, `unit-1-present-continuous-short-0001`,
`unit-1-stative-verbs-tf-0001`.

- Globally unique across the entire bank, not just within a topic.
- Never `question-1`, `mcq-1`, or anything that doesn't encode unit/topic/type.
- Once a question is linked to a lesson or has attempt history, **its id never
  changes**. If the wording changes, bump `"version"` instead.
- The shorthand after the topic id is short and lowercase: `mcq`, `short`,
  `tf`. Whatever shorthand you pick, `scripts/validate-question-bank.js`
  requires the filename to equal `{id}.json` and the id to match
  `^unit-[0-9]+-[a-z0-9-]+-[a-z]+-[0-9]{4}$`.

## Directory layout

```
data/question-bank/
  index.json                 # generated — id → type/unit/topic/difficulty/status/path
  manifests/
    unit-1.json               # generated — just the question ids for unit-1
  unit-1/
    present-simple/
      multiple-choice/unit-1-present-simple-mcq-0001.json
      short-answer/unit-1-present-simple-short-0001.json
      true-false/unit-1-present-simple-tf-0001.json
    present-continuous/...
    stative-verbs/...
data/schemas/                 # one *.schema.json per question type + question-base + review
data/reviews/unit-1-review.json
```

## Creating a new question

1. Pick an id following the rules above and create
   `data/question-bank/{unitId}/{topicId}/{typeFolder}/{id}.json`.
2. Fill in the base fields every question needs (see
   `data/schemas/question-base.schema.json`): `id`, `type`, `unitId`,
   `topicId`, `contentLocale`, `difficulty`, `prompt`, `status`, `version`,
   plus `explanation`, `tags`, `skills` where relevant.
3. Add the type-specific fields. See the matching schema and the examples
   below.
4. Run `npm run validate:questions`, then `npm run build:question-index`
   (or just `npm run build:data` to do both). **You never edit `index.json`
   or `manifests/*.json` by hand** — they're generated.
5. Reference the new id from a review's `questionIds`, or leave it to be
   picked up automatically by a `questionFilter` (random sections, topic
   practice).

That's it — no HTML/JS changes needed to add a question of an existing type.

### Multiple choice

```json
{
  "id": "unit-1-present-simple-mcq-0005",
  "type": "multiple-choice",
  "unitId": "unit-1",
  "topicId": "present-simple",
  "contentLocale": "en",
  "difficulty": "easy",
  "prompt": "Water ___ at 100 degrees Celsius.",
  "options": [{ "id": "a", "text": "boil" }, { "id": "b", "text": "boils" }],
  "correctOptionIds": ["b"],
  "selectionMode": "single",
  "shuffleOptions": true,
  "explanation": "General truths use the present simple.",
  "tags": ["general-truth"],
  "skills": ["grammar"],
  "status": "published",
  "version": 1
}
```

`correctOptionIds` is always an array, even for a single correct answer — that
keeps single- and multi-answer questions on the same shape.
`selectionMode: "multiple"` renders checkboxes instead of radio buttons.

### Short answer

```json
{
  "id": "unit-1-present-continuous-short-0004",
  "type": "short-answer",
  "unitId": "unit-1",
  "topicId": "present-continuous",
  "contentLocale": "en",
  "difficulty": "easy",
  "prompt": "Gordon ___ a letter at the moment. (write)",
  "acceptedAnswers": ["is writing", "Gordon is writing"],
  "answerValidation": {
    "caseSensitive": false,
    "trimWhitespace": true,
    "collapseWhitespace": true,
    "ignoreEndingPunctuation": true,
    "matchMode": "normalized"
  },
  "explanation": "...",
  "status": "published",
  "version": 1
}
```

`matchMode` is one of `exact`, `normalized` (default), `contains`, `regex`.
Grading always happens in `js/answer-validator.js` — renderers never decide
correctness themselves.

### True/false

```json
{
  "id": "unit-1-present-simple-tf-0004",
  "type": "true-false",
  "unitId": "unit-1",
  "topicId": "present-simple",
  "contentLocale": "en",
  "difficulty": "easy",
  "prompt": "The present simple is used to describe an action happening right now.",
  "correctAnswer": false,
  "explanation": "...",
  "status": "published",
  "version": 1
}
```

`correctAnswer` is a real JSON boolean, never the string `"true"`/`"false"`.

## Linking questions to a review

`data/reviews/unit-1-review.json` never embeds question content. Each section
is either:

- **`"selectionMode": "fixed"`** — an explicit, ordered `questionIds` list.
  Used for a curated review where you want specific questions every time.
- **`"selectionMode": "random"`** — a `questionFilter` (unit/topic/type/
  difficulty/status) plus `questionCount`, optionally a per-type
  `distribution` (e.g. `{ "multiple-choice": 7, "short-answer": 4 }`).
  `js/review-engine.js` never repeats a question already used earlier in the
  same attempt, even across sections.

A lesson topic opts into "Practice this topic" by setting
`topic.review.enabled: true` and a `questionFilter` in
`data/lessons/unit-1.json` — see the `present-simple` topic there for the
shape. Clicking the button (rendered by `lesson-renderer.js`, wired up by
`review-panel.js`) builds an **ephemeral** review in memory
(`review-engine.js`'s `createTopicPracticeReview()`) — no file is written for
a quick practice session.

## Running validation

```bash
npm run validate:questions
```

Checks (see `scripts/validate-question-bank.js` / `scripts/lib/question-rules.js`):

- Every file is valid JSON.
- Every question matches its type's schema (base fields + type-specific
  fields — `correctOptionIds` reference real options, `acceptedAnswers` is
  non-empty, `correctAnswer` is a real boolean, etc.).
- No duplicate ids across the whole bank.
- Filename matches `{id}.json`.
- `unitId` exists in `data/lessons/`; `topicId` exists under that unit.
- The file's folder matches its `unitId`/`topicId`.
- `difficulty` and `status` are valid enum values.
- A `published` question has a non-empty `explanation`.
- No whitespace or invalid characters in an id.
- Every review's `questionIds` point at real, published questions whose
  `type` matches the section's `type`.

Exits non-zero on any problem, with a list of every issue found (not just the
first one).

## Building the index

```bash
npm run build:question-index   # or: npm run build:data (validate + build)
```

Regenerates `data/question-bank/index.json` and
`data/question-bank/manifests/{unitId}.json` from the current files on disk.
Refuses to write anything if validation fails first. **Run this after adding,
editing, or removing any question or review** — the browser never scans
directories itself, it only reads these generated files.

## Adding a new Unit

1. Create `data/lessons/unit-2.json` (same shape as `unit-1.json`), with a
   `review` block and, per topic, a `topic.review.questionFilter`.
2. Create question files under `data/question-bank/unit-2/{topicId}/{type}/`.
3. Create `data/reviews/unit-2-review.json` if you want a curated review
   (optional — random sections work with just the question bank).
4. `npm run build:data`.

No code changes. Nothing in `js/` hard-codes `unit-1` — `question-loader.js`,
`review-engine.js`, and `review-panel.js` all work off whatever `lesson.id`
and `lesson.review` say.

## Adding a new question type

1. Add `data/schemas/{type}.schema.json` (see `matching.schema.json` /
   `ordering.schema.json` / `fill-in-the-blanks.schema.json` /
   `error-identification.schema.json` for schemas already prepared but not
   yet wired into the UI).
2. Add validation rules to `scripts/lib/question-rules.js` (`TYPE_VALIDATORS`
   map) and add `"{type}"` to `QUESTION_TYPES` there and in
   `data/schemas/question-base.schema.json`.
3. Add `js/renderers/{type}-renderer.js` exporting `render(question,
   container, { savedAnswer, onChange })` → `{ getAnswer, showFeedback,
   disable }` (match the shape of `multiple-choice-renderer.js`).
4. Add a `validate{Type}(question, answer)` function to
   `js/answer-validator.js` and register it in the `VALIDATORS` map.
5. Register the renderer in `QUESTION_RENDERERS` inside `js/review-panel.js`.
6. Add a locale key under `questionTypes.*` in both
   `locales/en/question-types.json` and `locales/vi/question-types.json`.
7. Add tests next to the new renderer/validator, following the pattern in
   `js/answer-validator.test.js`.

None of this touches existing types — `multiple-choice`, `short-answer`, and
`true-false` keep working exactly as before.

## Testing

```bash
npm test
```

Runs Node's built-in test runner (`node --test`) over every `*.test.js` file:

- `js/answer-validator.test.js` — grading logic for all three shipped types,
  including edge cases (unanswered, wrong case/whitespace/punctuation,
  contractions, the "true" string vs. boolean `true` trap).
- `js/score-calculator.test.js` — totals, pass/fail, byTopic/byType
  breakdowns, empty-review edge case.
- `js/question-loader.test.js` — id lookup, missing-question handling,
  filters, random selection (count, distribution, `avoidIds`), caching.
  Spins up its own throwaway static file server
  (`js/test-helpers/static-server.js`) so it exercises the real `fetch()`
  path, not a mock.
- `js/review-engine.test.js` — resolving a review into an ordered attempt,
  answer/submit/next flow, scoring a full attempt, resuming an in-progress
  attempt after a simulated reload, and topic practice.

## Common JSON mistakes

- **`correctOptionIds` as a bare string** instead of an array — always
  `["b"]`, even for one answer.
- **`correctAnswer` as `"true"`/`"false"` string** on a true/false question —
  must be the JSON boolean `true`/`false`.
- **Filename not matching `id`** — `validate-question-bank.js` catches this;
  the file must be named `{id}.json`.
- **`topicId` that doesn't exist on the unit's lesson file** — check
  `data/lessons/{unitId}.json`'s `topics[].id` list.
- **Forgetting `explanation` on a `"status": "published"` question** — the
  validator flags this (learners see the explanation after submitting).
- **Editing `index.json` or `manifests/*.json` by hand** — they're
  regenerated by `npm run build:question-index` and any manual edit is lost
  (and will drift from the real files on disk).
- **A review section referencing a `draft`/`archived` question** — fixed
  sections must reference `published` questions.
