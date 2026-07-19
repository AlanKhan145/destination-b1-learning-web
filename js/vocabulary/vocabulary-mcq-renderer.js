// vocabulary-mcq-renderer.js
// Renders a single-answer multiple-choice question for the "choose the
// meaning" / "choose the picture" review modes. Mirrors the shape of
// js/renderers/multiple-choice-renderer.js (render(item, container, {onChange})
// => {getAnswer, showFeedback, disable}) but item.options here are
// { id, content, isImage? } rather than question-bank options, since the
// vocabulary item shape is different from a question-bank Question.

import { shuffle, createElement } from "../utils.js";

function render(item, container, { onChange } = {}) {
  container.innerHTML = "";
  const options = shuffle(item.options);
  const groupName = `vocab-mcq-${item.id}`;
  let selected = null;

  const list = createElement("ul", { className: "mc-options vocab-mcq-options" });
  const optionElements = new Map();

  options.forEach((option) => {
    const inputId = `${groupName}-${option.id}`;
    const input = createElement("input", { attrs: { type: "radio", name: groupName, id: inputId, value: option.id } });

    input.addEventListener("change", () => {
      selected = option.id;
      onChange?.(selected);
    });

    const contentEl = option.isImage
      ? createElement("img", { className: "vocab-mcq-option-image", attrs: { src: option.content, loading: "lazy", alt: "" } })
      : createElement("span", { className: "mc-option-text", text: option.content });

    const label = createElement("label", { className: "mc-option-label", attrs: { for: inputId } }, [input, contentEl]);
    const li = createElement("li", { className: `mc-option${option.isImage ? " mc-option--image" : ""}` }, [label]);
    list.appendChild(li);
    optionElements.set(option.id, { li, input });
  });

  container.appendChild(list);

  return {
    getAnswer: () => selected,
    showFeedback(correctOptionId) {
      optionElements.forEach(({ li }, optionId) => {
        li.classList.toggle("is-correct", optionId === correctOptionId);
        li.classList.toggle("is-incorrect", optionId === selected && optionId !== correctOptionId);
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
