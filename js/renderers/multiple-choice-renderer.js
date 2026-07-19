// multiple-choice-renderer.js
// Renders options as radio (selectionMode: "single") or checkbox (selectionMode:
// "multiple") inputs. Purely presentational — correctness is decided by
// answer-validator.js, this module only reports the raw selection.
import { shuffle, createElement } from "../utils.js";

function render(question, container, { savedAnswer, onChange } = {}) {
  container.innerHTML = "";
  const selected = new Set(savedAnswer || []);
  const isMultiple = question.selectionMode === "multiple";
  const inputType = isMultiple ? "checkbox" : "radio";
  const groupName = `mc-${question.id}`;

  const options = question.shuffleOptions === false ? question.options : shuffle(question.options);
  const list = createElement("ul", { className: "mc-options" });
  const optionElements = new Map();

  options.forEach((option) => {
    const inputId = `${groupName}-${option.id}`;
    const input = createElement("input", {
      attrs: { type: inputType, name: groupName, id: inputId, value: option.id }
    });
    if (selected.has(option.id)) input.checked = true;

    input.addEventListener("change", () => {
      if (isMultiple) {
        if (input.checked) selected.add(option.id);
        else selected.delete(option.id);
      } else {
        selected.clear();
        selected.add(option.id);
      }
      onChange?.(Array.from(selected));
    });

    const label = createElement(
      "label",
      { className: "mc-option-label", attrs: { for: inputId } },
      [input, createElement("span", { className: "mc-option-text", text: option.text })]
    );

    const item = createElement("li", { className: "mc-option" }, [label]);
    list.appendChild(item);
    optionElements.set(option.id, { item, input });
  });

  container.appendChild(list);

  return {
    getAnswer: () => Array.from(selected),
    showFeedback(result) {
      const correctIds = new Set(question.correctOptionIds);
      optionElements.forEach(({ item }, optionId) => {
        item.classList.toggle("is-correct", correctIds.has(optionId));
        item.classList.toggle("is-incorrect", selected.has(optionId) && !correctIds.has(optionId));
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
