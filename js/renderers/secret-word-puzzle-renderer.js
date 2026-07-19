// secret-word-puzzle-renderer.js
// Renders N sub-clues (each a letter-box row, per createLetterBoxRow) with
// one box per word highlighted as the letter that feeds the final secret
// word, plus a final letter-box row for the secret word itself.
import { t } from "../i18n.js";
import { createElement } from "../utils.js";
import { createLetterBoxRow } from "./letter-box-input.js";

function render(question, container, { savedAnswer, onChange } = {}) {
  container.innerHTML = "";

  const saved = savedAnswer && typeof savedAnswer === "object" ? savedAnswer : { words: [], secret: "" };
  const state = { words: question.words.map((_, i) => saved.words?.[i] || ""), secret: saved.secret || "" };

  function emitChange() {
    onChange?.({ words: [...state.words], secret: state.secret });
  }

  const wordsContainer = createElement("div", { className: "secret-puzzle-words" });
  const wordBoxRows = question.words.map((word, index) => {
    const row = createElement("div", { className: "secret-puzzle-word-row" });
    row.appendChild(createElement("p", { className: "secret-puzzle-clue", text: `${index + 1}. ${word.clue}` }));

    const boxRow = createLetterBoxRow(word.letterCount, {
      initialValue: state.words[index],
      ariaLabel: word.clue,
      onChange: (value) => {
        state.words[index] = value;
        emitChange();
      }
    });
    boxRow.highlightIndex(word.revealIndex);

    row.appendChild(boxRow.element);
    wordsContainer.appendChild(row);
    return boxRow;
  });
  container.appendChild(wordsContainer);

  const secretSection = createElement("div", { className: "secret-puzzle-final" });
  secretSection.appendChild(createElement("p", { className: "secret-puzzle-final-label", text: t("review.secretWordLabel") }));
  const secretBoxRow = createLetterBoxRow(question.secretAnswer.length, {
    initialValue: state.secret,
    ariaLabel: t("review.secretWordLabel"),
    onChange: (value) => {
      state.secret = value;
      emitChange();
    }
  });
  secretSection.appendChild(secretBoxRow.element);
  container.appendChild(secretSection);

  return {
    getAnswer: () => ({ words: wordBoxRows.map((row) => row.getValue()), secret: secretBoxRow.getValue() }),
    showFeedback(result) {
      question.words.forEach((word, index) => wordBoxRows[index].setResult(word.answer));
      secretBoxRow.setResult(question.secretAnswer);
    },
    disable() {
      wordBoxRows.forEach((row) => row.setDisabled(true));
      secretBoxRow.setDisabled(true);
    }
  };
}

export { render };
