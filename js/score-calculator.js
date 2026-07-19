// score-calculator.js
// Turns a list of (question, validation result) pairs into the summary shown
// on the results screen: totals, pass/fail, and breakdowns by topic and type.
// Unanswered or failed-to-load questions are excluded from the denominator
// only for "answeredQuestions"; they still count toward totalQuestions.

function incrementBucket(buckets, key, isCorrect) {
  if (!buckets[key]) buckets[key] = { correct: 0, total: 0 };
  buckets[key].total += 1;
  if (isCorrect) buckets[key].correct += 1;
}

/**
 * entries: array of { question, result } where `result` is the output of
 * answer-validator's validateAnswer(), or null/undefined if the learner
 * never answered that question.
 */
function computeScore(review, entries) {
  const totalQuestions = entries.length;
  let answeredQuestions = 0;
  let correctQuestions = 0;
  const byTopic = {};
  const byType = {};

  for (const { question, result } of entries) {
    const isAnswered = Boolean(result);
    if (isAnswered) answeredQuestions += 1;

    const isCorrect = Boolean(result && result.isCorrect);
    if (isCorrect) correctQuestions += 1;

    incrementBucket(byTopic, question.topicId, isCorrect);
    incrementBucket(byType, question.type, isCorrect);
  }

  const scorePercent = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;
  const passingScore = typeof review.passingScore === "number" ? review.passingScore : 0;

  return {
    reviewId: review.id,
    totalQuestions,
    answeredQuestions,
    correctQuestions,
    scorePercent,
    passingScore,
    passed: scorePercent >= passingScore,
    byTopic,
    byType
  };
}

export { computeScore };
