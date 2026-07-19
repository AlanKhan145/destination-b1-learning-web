// true-false-renderer.js
// Two radio buttons bound to real booleans (never the strings "true"/"false") —
// answer-validator.js relies on typeof answer === "boolean".
import { createElement } from "../utils.js";
import { t } from "../i18n.js";

function render(question, container, { savedAnswer, onChange } = {}) {
  container.innerHTML = "";
  const groupName = `tf-${question.id}`;
  let selected = typeof savedAnswer === "boolean" ? savedAnswer : null;

  const choices = [
    { value: true, labelKey: "review.true" },
    { value: false, labelKey: "review.false" }
  ];

  const list = createElement("ul", { className: "tf-options" });
  const optionElements = [];

  choices.forEach(({ value, labelKey }) => {
    const inputId = `${groupName}-${value}`;
    const input = createElement("input", {
      attrs: { type: "radio", name: groupName, id: inputId }
    });
    input.checked = selected === value;

    input.addEventListener("change", () => {
      selected = value;
      onChange?.(selected);
    });

    const label = createElement(
      "label",
      { className: "tf-option-label", attrs: { for: inputId } },
      [input, createElement("span", { className: "tf-option-text", text: t(labelKey) })]
    );

    const item = createElement("li", { className: "tf-option" }, [label]);
    list.appendChild(item);
    optionElements.push({ value, item, input });
  });

  container.appendChild(list);

  return {
    getAnswer: () => selected,
    showFeedback(result) {
      optionElements.forEach(({ value, item }) => {
        item.classList.toggle("is-correct", value === question.correctAnswer);
        item.classList.toggle("is-incorrect", value === selected && value !== question.correctAnswer);
      });
    },
    disable() {
      optionElements.forEach(({ input }) => {
        input.disabled = true;
      });
    }
  };
}

export { render };
