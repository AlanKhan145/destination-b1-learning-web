// short-answer-renderer.js
// A single text input. Grading (case, punctuation, matchMode) lives entirely
// in answer-validator.js — this renderer just captures the raw string.
import { createElement } from "../utils.js";

function render(question, container, { savedAnswer, onChange } = {}) {
  container.innerHTML = "";

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

export { render };
