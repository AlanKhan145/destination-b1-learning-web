// fill-in-the-blanks-renderer.js
// Renders question.passageTemplate (text with {{blankId}} tokens) as flowing
// paragraphs with a real <input> in place of each token — reads like the
// original worksheet instead of a flat list of disconnected blanks.
import { createElement } from "../utils.js";
import { normalizeText } from "../answer-validator.js";

const MATCH_OPTIONS = { caseSensitive: false, trimWhitespace: true, collapseWhitespace: true, ignoreEndingPunctuation: true };
const BLANK_TOKEN_PATTERN = /\{\{([a-z0-9-]+)\}\}/g;

function buildParagraph(paragraphText, state, onAnyChange) {
  const paragraph = createElement("p", { className: "fill-blank-passage-paragraph" });
  const inputs = [];

  const parts = paragraphText.split(BLANK_TOKEN_PATTERN);
  parts.forEach((part, index) => {
    const isBlankToken = index % 2 === 1;
    if (!isBlankToken) {
      if (part) paragraph.appendChild(document.createTextNode(part));
      return;
    }

    const blankId = part;
    const input = createElement("input", {
      className: "blank-input",
      attrs: { type: "text", autocomplete: "off", "aria-label": blankId }
    });
    input.value = state[blankId] || "";
    input.addEventListener("input", () => {
      state[blankId] = input.value;
      onAnyChange();
    });

    paragraph.appendChild(input);
    inputs.push({ blankId, input });
  });

  return { element: paragraph, inputs };
}

function render(question, container, { savedAnswer, onChange } = {}) {
  container.innerHTML = "";
  const state = savedAnswer && typeof savedAnswer === "object" ? { ...savedAnswer } : {};
  const allInputs = [];

  const wrapper = createElement("div", { className: "fill-blank-passage" });
  (question.passageTemplate || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .forEach((paragraphText) => {
      const { element, inputs } = buildParagraph(paragraphText, state, () => onChange?.({ ...state }));
      wrapper.appendChild(element);
      allInputs.push(...inputs);
    });
  container.appendChild(wrapper);

  return {
    getAnswer: () => ({ ...state }),
    showFeedback() {
      allInputs.forEach(({ blankId, input }) => {
        const blank = question.blanks.find((b) => b.id === blankId);
        const normalizedUser = normalizeText(input.value, MATCH_OPTIONS);
        const isRight = Boolean(blank) && blank.acceptedAnswers.some((accepted) => normalizeText(accepted, MATCH_OPTIONS) === normalizedUser);
        input.classList.toggle("is-correct", isRight);
        input.classList.toggle("is-incorrect", !isRight);
      });
    },
    disable() {
      allInputs.forEach(({ input }) => {
        input.disabled = true;
      });
    }
  };
}

export { render };
