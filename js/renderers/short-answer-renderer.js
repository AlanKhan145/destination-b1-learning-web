// short-answer-renderer.js
// Either a single text input, or — when question.letterCount is set —
// a crossword-clue-style row of single-letter boxes. Grading (case,
// punctuation, matchMode) lives entirely in answer-validator.js either way;
// this renderer only ever captures/paints a raw string.
import { createElement } from "../utils.js";
import { createLetterBoxRow } from "./letter-box-input.js";

function renderLetterBoxes(question, container, { savedAnswer, onChange }) {
  const boxRow = createLetterBoxRow(question.letterCount, {
    initialValue: savedAnswer || "",
    ariaLabel: question.prompt,
    onChange
  });
  container.appendChild(createElement("div", { className: "short-answer-field" }, [boxRow.element]));

  return {
    getAnswer: () => boxRow.getValue(),
    showFeedback(result) {
      boxRow.setResult(result.correctAnswer?.[0] || "");
    },
    disable() {
      boxRow.setDisabled(true);
    }
  };
}

function renderPlainInput(question, container, { savedAnswer, onChange }) {
  const input = createElement("input", {
    className: "short-answer-input",
    attrs: { type: "text", autocomplete: "off", "aria-label": question.prompt }
  });
  input.value = savedAnswer || "";
  input.addEventListener("input", () => onChange?.(input.value));

  container.appendChild(createElement("div", { className: "short-answer-field" }, [input]));

  return {
    getAnswer: () => input.value,
    showFeedback(result) {
      input.classList.toggle("is-correct", result.isCorrect);
      input.classList.toggle("is-incorrect", !result.isCorrect);
    },
    disable() {
      input.disabled = true;
    }
  };
}

function render(question, container, options = {}) {
  container.innerHTML = "";
  return question.letterCount
    ? renderLetterBoxes(question, container, options)
    : renderPlainInput(question, container, options);
}

export { render };
