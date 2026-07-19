// answer-validator.js
// Pure grading logic: takes a question + the learner's raw answer, returns a
// normalized result. Renderers never decide correct/incorrect themselves —
// they only collect the raw answer and hand it here.

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

function buildResult({ isCorrect, userAnswer, correctAnswer, explanation }) {
  return {
    isCorrect,
    score: isCorrect ? 1 : 0,
    maxScore: 1,
    userAnswer: userAnswer ?? null,
    correctAnswer,
    explanation: explanation ?? null
  };
}

/** answer: array of selected option ids (single-select uses a 1-item array). */
function validateMultipleChoice(question, answer) {
  const userAnswer = Array.isArray(answer) ? answer : answer ? [answer] : [];
  const isCorrect = userAnswer.length > 0 && sameSet(userAnswer, question.correctOptionIds);

  return buildResult({
    isCorrect,
    userAnswer,
    correctAnswer: question.correctOptionIds,
    explanation: question.explanation
  });
}

function stripEndingPunctuation(text) {
  return text.replace(/[.!?]+$/g, "");
}

function normalizeText(text, options) {
  let value = String(text ?? "");
  if (options.trimWhitespace !== false) value = value.trim();
  if (options.collapseWhitespace !== false) value = value.replace(/\s+/g, " ");
  if (options.ignoreEndingPunctuation !== false) value = stripEndingPunctuation(value).trim();
  if (!options.caseSensitive) value = value.toLowerCase();
  return value;
}

/** answer: raw string typed by the learner. */
function validateShortAnswer(question, answer) {
  const options = question.answerValidation || {};
  const matchMode = options.matchMode || "normalized";
  const rawAnswer = typeof answer === "string" ? answer : "";

  let isCorrect = false;

  if (rawAnswer !== "") {
    if (matchMode === "regex") {
      const flags = options.caseSensitive ? "" : "i";
      isCorrect = question.acceptedAnswers.some((pattern) => {
        try {
          return new RegExp(pattern, flags).test(rawAnswer);
        } catch (error) {
          console.error(`[answer-validator] invalid regex accepted answer on ${question.id}:`, error);
          return false;
        }
      });
    } else if (matchMode === "exact") {
      const compareUser = options.caseSensitive ? rawAnswer : rawAnswer.toLowerCase();
      isCorrect = question.acceptedAnswers.some((accepted) => {
        const compareAccepted = options.caseSensitive ? accepted : accepted.toLowerCase();
        return compareUser === compareAccepted;
      });
    } else {
      const normalizedUser = normalizeText(rawAnswer, options);
      isCorrect = question.acceptedAnswers.some((accepted) => {
        const normalizedAccepted = normalizeText(accepted, options);
        return matchMode === "contains"
          ? normalizedUser.includes(normalizedAccepted)
          : normalizedUser === normalizedAccepted;
      });
    }
  }

  return buildResult({
    isCorrect,
    userAnswer: rawAnswer,
    correctAnswer: question.acceptedAnswers,
    explanation: question.explanation
  });
}

/** answer: boolean (never a string — the renderer must produce a real boolean). */
function validateTrueFalse(question, answer) {
  const isCorrect = typeof answer === "boolean" && answer === question.correctAnswer;

  return buildResult({
    isCorrect,
    userAnswer: typeof answer === "boolean" ? answer : null,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation
  });
}

/** answer: { [pairId]: rightText } mapping chosen by the learner. */
function validateMatching(question, answer) {
  const userAnswer = answer && typeof answer === "object" ? answer : {};
  const isCorrect = question.pairs.every((pair) => userAnswer[pair.id] === pair.right);

  return buildResult({
    isCorrect,
    userAnswer,
    correctAnswer: Object.fromEntries(question.pairs.map((pair) => [pair.id, pair.right])),
    explanation: question.explanation
  });
}

/** answer: array of item ids in the learner's chosen order. */
function validateOrdering(question, answer) {
  const userAnswer = Array.isArray(answer) ? answer : [];
  const isCorrect =
    userAnswer.length === question.correctOrder.length &&
    userAnswer.every((id, i) => id === question.correctOrder[i]);

  return buildResult({
    isCorrect,
    userAnswer,
    correctAnswer: question.correctOrder,
    explanation: question.explanation
  });
}

const VALIDATORS = {
  "multiple-choice": validateMultipleChoice,
  "short-answer": validateShortAnswer,
  "true-false": validateTrueFalse,
  matching: validateMatching,
  ordering: validateOrdering
};

/** Dispatches to the right validator based on question.type. */
function validateAnswer(question, answer) {
  const validator = VALIDATORS[question.type];
  if (!validator) throw new Error(`No answer validator registered for question type "${question.type}"`);
  return validator(question, answer);
}

export {
  validateAnswer,
  validateMultipleChoice,
  validateShortAnswer,
  validateTrueFalse,
  validateMatching,
  validateOrdering
};
