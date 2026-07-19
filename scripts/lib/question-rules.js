// Hand-rolled validation rules mirroring data/schemas/*.schema.json.
// No ajv dependency: the project has no package manager install step, so schema
// enforcement is implemented directly here. The .schema.json files remain the
// authoritative documentation of the shape; keep the two in sync when either changes.

export const DIFFICULTIES = ["easy", "medium", "hard"];
export const STATUSES = ["draft", "published", "archived"];
export const LOCALES = ["en", "vi"];
export const QUESTION_TYPES = [
  "multiple-choice",
  "short-answer",
  "true-false",
  "fill-in-the-blanks",
  "matching",
  "ordering",
  "error-identification",
  "secret-word-puzzle"
];

// Format: {unitId}-{topicId}-{questionType}-{0001}. unitId is usually unit-{n},
// but a cumulative review can host its own question bank under its own lesson
// id (e.g. review-1), so the prefix is {word}-{n} rather than literally "unit".
export const ID_PATTERN = /^[a-z]+-[0-9]+-[a-z0-9-]+-[a-z]+-[0-9]{4}$/;
const REQUIRED_BASE_FIELDS = ["id", "type", "unitId", "topicId", "contentLocale", "difficulty", "prompt", "status", "version"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** Validates the fields every question must have, regardless of type. */
function validateBaseFields(question) {
  const errors = [];

  for (const field of REQUIRED_BASE_FIELDS) {
    if (question[field] === undefined || question[field] === null || question[field] === "") {
      errors.push(`missing required field "${field}"`);
    }
  }

  if (isNonEmptyString(question.id) && !ID_PATTERN.test(question.id)) {
    errors.push(`id "${question.id}" does not match pattern unit-{n}-{topicId}-{type}-{0001}`);
  }
  if (isNonEmptyString(question.id) && /\s/.test(question.id)) {
    errors.push(`id "${question.id}" contains whitespace`);
  }
  if (question.type !== undefined && !QUESTION_TYPES.includes(question.type)) {
    errors.push(`unknown type "${question.type}"`);
  }
  if (question.contentLocale !== undefined && !LOCALES.includes(question.contentLocale)) {
    errors.push(`invalid contentLocale "${question.contentLocale}"`);
  }
  if (question.difficulty !== undefined && !DIFFICULTIES.includes(question.difficulty)) {
    errors.push(`invalid difficulty "${question.difficulty}" (expected ${DIFFICULTIES.join("|")})`);
  }
  if (question.status !== undefined && !STATUSES.includes(question.status)) {
    errors.push(`invalid status "${question.status}" (expected ${STATUSES.join("|")})`);
  }
  if (question.status === "published" && !isNonEmptyString(question.explanation)) {
    errors.push("published question is missing an explanation");
  }
  if (question.version !== undefined && !(Number.isInteger(question.version) && question.version >= 1)) {
    errors.push("version must be an integer >= 1");
  }

  return errors;
}

function validateMultipleChoice(question) {
  const errors = [];
  const options = question.options;

  if (!Array.isArray(options) || options.length < 2) {
    errors.push("multiple-choice question needs at least 2 options");
    return errors;
  }

  const seenIds = new Set();
  const seenText = new Set();
  for (const option of options) {
    if (!option || !isNonEmptyString(option.id) || !isNonEmptyString(option.text)) {
      errors.push("every option needs a non-empty id and text");
      continue;
    }
    if (seenIds.has(option.id)) errors.push(`duplicate option id "${option.id}"`);
    seenIds.add(option.id);

    const normalizedText = option.text.trim().toLowerCase();
    if (seenText.has(normalizedText)) errors.push(`duplicate option text "${option.text}"`);
    seenText.add(normalizedText);
  }

  if (!Array.isArray(question.correctOptionIds) || question.correctOptionIds.length < 1) {
    errors.push("correctOptionIds must be a non-empty array");
  } else {
    for (const id of question.correctOptionIds) {
      if (!seenIds.has(id)) errors.push(`correctOptionIds references option "${id}" which does not exist`);
    }
  }

  if (!["single", "multiple"].includes(question.selectionMode)) {
    errors.push(`invalid selectionMode "${question.selectionMode}" (expected single|multiple)`);
  }
  if (question.selectionMode === "single" && Array.isArray(question.correctOptionIds) && question.correctOptionIds.length > 1) {
    errors.push("selectionMode is single but correctOptionIds has more than one entry");
  }

  return errors;
}

function validateShortAnswer(question) {
  const errors = [];
  if (!Array.isArray(question.acceptedAnswers) || question.acceptedAnswers.length < 1) {
    errors.push("acceptedAnswers must be a non-empty array");
  } else if (question.acceptedAnswers.some((answer) => !isNonEmptyString(answer))) {
    errors.push("acceptedAnswers must contain only non-empty strings");
  } else if (
    question.letterCount !== undefined &&
    !question.acceptedAnswers.some((answer) => answer.length === question.letterCount)
  ) {
    errors.push(`letterCount ${question.letterCount} does not match the length of any acceptedAnswers entry`);
  }

  if (question.letterCount !== undefined && !(Number.isInteger(question.letterCount) && question.letterCount >= 1)) {
    errors.push("letterCount must be an integer >= 1");
  }

  const matchMode = question.answerValidation?.matchMode;
  if (matchMode !== undefined && !["exact", "normalized", "contains", "regex"].includes(matchMode)) {
    errors.push(`invalid answerValidation.matchMode "${matchMode}"`);
  }

  return errors;
}

function validateSecretWordPuzzle(question) {
  const errors = [];
  if (!Array.isArray(question.words) || question.words.length < 2) {
    errors.push("secret-word-puzzle needs at least 2 words");
    return errors;
  }

  question.words.forEach((word, index) => {
    if (!word || !isNonEmptyString(word.clue) || !isNonEmptyString(word.answer)) {
      errors.push(`words[${index}] needs a non-empty clue and answer`);
      return;
    }
    if (word.letterCount !== word.answer.length) {
      errors.push(`words[${index}] letterCount (${word.letterCount}) does not match answer.length (${word.answer.length})`);
    }
    if (!Number.isInteger(word.revealIndex) || word.revealIndex < 1 || word.revealIndex > word.answer.length) {
      errors.push(`words[${index}] revealIndex ${word.revealIndex} is out of range for answer "${word.answer}"`);
    }
  });

  if (!isNonEmptyString(question.secretAnswer)) {
    errors.push("secretAnswer must be a non-empty string");
  } else if (errors.length === 0) {
    const derived = question.words.map((word) => (word.answer[word.revealIndex - 1] || "").toUpperCase()).join("");
    if (derived !== question.secretAnswer.toUpperCase()) {
      errors.push(`secretAnswer "${question.secretAnswer}" does not match the letters derived from words (got "${derived}")`);
    }
  }

  return errors;
}

function validateTrueFalse(question) {
  const errors = [];
  if (typeof question.correctAnswer !== "boolean") {
    errors.push(`correctAnswer must be a boolean, got ${JSON.stringify(question.correctAnswer)}`);
  }
  return errors;
}

function validateFillInTheBlanks(question) {
  const errors = [];
  if (!Array.isArray(question.blanks) || question.blanks.length < 1) {
    errors.push("blanks must be a non-empty array");
    return errors;
  }
  for (const blank of question.blanks) {
    if (!blank || !isNonEmptyString(blank.id)) errors.push("every blank needs a non-empty id");
    if (!Array.isArray(blank?.acceptedAnswers) || blank.acceptedAnswers.length < 1) {
      errors.push(`blank "${blank?.id}" needs a non-empty acceptedAnswers array`);
    }
    if (isNonEmptyString(question.passageTemplate) && blank?.id && !question.passageTemplate.includes(`{{${blank.id}}}`)) {
      errors.push(`passageTemplate is missing the {{${blank.id}}} token for blank "${blank.id}"`);
    }
  }
  return errors;
}

function validateMatching(question) {
  const errors = [];
  if (!Array.isArray(question.pairs) || question.pairs.length < 2) {
    errors.push("matching question needs at least 2 pairs");
    return errors;
  }
  const seen = new Set();
  for (const pair of question.pairs) {
    if (!pair || !isNonEmptyString(pair.id) || !isNonEmptyString(pair.left) || !isNonEmptyString(pair.right)) {
      errors.push("every pair needs id, left and right");
      continue;
    }
    if (seen.has(pair.id)) errors.push(`duplicate pair id "${pair.id}"`);
    seen.add(pair.id);
  }
  return errors;
}

function validateOrdering(question) {
  const errors = [];
  if (!Array.isArray(question.items) || question.items.length < 2) {
    errors.push("ordering question needs at least 2 items");
    return errors;
  }
  const ids = new Set(question.items.map((item) => item?.id));
  if (ids.size !== question.items.length) errors.push("ordering items contain duplicate ids");

  if (!Array.isArray(question.correctOrder) || question.correctOrder.length !== question.items.length) {
    errors.push("correctOrder must list every item id exactly once");
  } else {
    for (const id of question.correctOrder) {
      if (!ids.has(id)) errors.push(`correctOrder references item "${id}" which does not exist`);
    }
  }
  return errors;
}

function validateErrorIdentification(question) {
  const errors = [];
  if (!Array.isArray(question.segments) || question.segments.length < 2) {
    errors.push("error-identification question needs at least 2 segments");
    return errors;
  }
  const ids = new Set(question.segments.map((segment) => segment?.id));
  if (!Array.isArray(question.correctSegmentIds) || question.correctSegmentIds.length < 1) {
    errors.push("correctSegmentIds must be a non-empty array");
  } else {
    for (const id of question.correctSegmentIds) {
      if (!ids.has(id)) errors.push(`correctSegmentIds references segment "${id}" which does not exist`);
    }
  }
  return errors;
}

const TYPE_VALIDATORS = {
  "multiple-choice": validateMultipleChoice,
  "short-answer": validateShortAnswer,
  "true-false": validateTrueFalse,
  "fill-in-the-blanks": validateFillInTheBlanks,
  matching: validateMatching,
  ordering: validateOrdering,
  "error-identification": validateErrorIdentification,
  "secret-word-puzzle": validateSecretWordPuzzle
};

/** Validates a single question object. Returns an array of human-readable error strings (empty = valid). */
export function validateQuestion(question) {
  if (!question || typeof question !== "object") return ["question is not a JSON object"];

  const errors = validateBaseFields(question);
  const typeValidator = TYPE_VALIDATORS[question.type];
  if (typeValidator) errors.push(...typeValidator(question));

  return errors;
}
