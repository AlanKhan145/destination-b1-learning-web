// letter-box-input.js
// Shared OTP-style single-character input row, used by short-answer-renderer.js
// (when question.letterCount is set) and secret-word-puzzle-renderer.js.
// Not a full renderer contract on its own — a small DOM+state helper the
// actual renderers compose into their getAnswer/showFeedback/disable shape.
import { createElement } from "../utils.js";

/**
 * Creates a row of `length` single-character boxes.
 * `initialValue` pre-fills box characters (used when resuming a saved answer).
 * `onChange(value)` fires with the joined uppercase string on every edit.
 * Returns { element, getValue, setDisabled, setResult }.
 */
function createLetterBoxRow(length, { initialValue = "", onChange, ariaLabel } = {}) {
  const wrapper = createElement("div", { className: "letter-box-row" });
  const boxes = [];

  for (let i = 0; i < length; i++) {
    const box = createElement("input", {
      className: "letter-box",
      attrs: {
        type: "text",
        maxlength: "1",
        autocomplete: "off",
        "aria-label": `${ariaLabel || "letter"} ${i + 1}`
      }
    });
    box.value = (initialValue[i] || "").toUpperCase();
    boxes.push(box);
    wrapper.appendChild(box);
  }

  function getValue() {
    return boxes.map((box) => box.value).join("");
  }

  boxes.forEach((box, index) => {
    box.addEventListener("input", () => {
      box.value = box.value.slice(-1).toUpperCase();
      if (box.value && index < boxes.length - 1) boxes[index + 1].focus();
      onChange?.(getValue());
    });

    box.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !box.value && index > 0) {
        boxes[index - 1].focus();
      }
    });
  });

  return {
    element: wrapper,
    getValue,
    setDisabled(disabled) {
      boxes.forEach((box) => {
        box.disabled = disabled;
      });
    },
    /** Paints each box green/red against `correctWord`, letter by letter. */
    setResult(correctWord) {
      boxes.forEach((box, index) => {
        const expected = (correctWord[index] || "").toUpperCase();
        const isRight = expected !== "" && box.value.toUpperCase() === expected;
        box.classList.toggle("is-correct", isRight);
        box.classList.toggle("is-incorrect", !isRight);
      });
    },
    /** Highlights one box (1-based index) as the letter that feeds a secret word. */
    highlightIndex(oneBasedIndex) {
      boxes[oneBasedIndex - 1]?.classList.add("letter-box--reveal");
    }
  };
}

export { createLetterBoxRow };
