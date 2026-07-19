// vocabulary-grader.js
// Grading for the "type the word" review mode. Wraps answer-validator.js's
// normalizeText so whitespace/case/punctuation differences are forgiven but
// actual misspellings are not (no fuzzy matching — per spec, typos are wrong).

import { normalizeText } from "../answer-validator.js";

const TYPING_MATCH_OPTIONS = {
  caseSensitive: false,
  trimWhitespace: true,
  collapseWhitespace: true,
  ignoreEndingPunctuation: true
};

/** `acceptedVariants` covers entries with more than one correct spelling/wording (e.g. "in the middle" / "in the middle of"). */
function gradeTyped(userText, correctWord, acceptedVariants = []) {
  const normalizedUser = normalizeText(userText || "", TYPING_MATCH_OPTIONS);
  if (normalizedUser === "") return false;

  return [correctWord, ...acceptedVariants].some(
    (candidate) => normalizeText(candidate, TYPING_MATCH_OPTIONS) === normalizedUser
  );
}

export { gradeTyped };
