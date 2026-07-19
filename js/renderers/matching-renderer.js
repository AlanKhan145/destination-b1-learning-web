// matching-renderer.js
// One <select> per left-hand item, options = every right-hand item
// (shuffled once). Fits the review-panel's submit-then-feedback contract
// directly — unlike js/vocabulary/matching-engine.js's tap-to-pair overlay
// (which self-checks per click, has no submit/disable/resume hooks), this
// renderer needs getAnswer()/showFeedback()/disable() like every other type.
import { createElement, shuffle } from "../utils.js";

function render(question, container, { savedAnswer, onChange } = {}) {
  container.innerHTML = "";
  const saved = savedAnswer && typeof savedAnswer === "object" ? savedAnswer : {};

  const rightOptions = question.shuffleRightItems === false ? question.pairs.map((pair) => pair.right) : shuffle(question.pairs.map((pair) => pair.right));

  const list = createElement("ul", { className: "matching-list" });
  const selects = new Map();

  function emitChange() {
    onChange?.(Object.fromEntries([...selects].map(([pairId, select]) => [pairId, select.value])));
  }

  question.pairs.forEach((pair) => {
    const row = createElement("li", { className: "matching-row" });
    row.appendChild(createElement("span", { className: "matching-left", text: pair.left }));

    const select = createElement("select", { className: "matching-select", attrs: { "aria-label": pair.left } });
    select.appendChild(createElement("option", { text: "—", attrs: { value: "" } }));
    rightOptions.forEach((right) => select.appendChild(createElement("option", { text: right, attrs: { value: right } })));
    select.value = saved[pair.id] || "";
    select.addEventListener("change", emitChange);

    row.appendChild(select);
    list.appendChild(row);
    selects.set(pair.id, select);
  });

  container.appendChild(list);

  return {
    getAnswer: () => Object.fromEntries([...selects].map(([pairId, select]) => [pairId, select.value])),
    showFeedback() {
      question.pairs.forEach((pair) => {
        const select = selects.get(pair.id);
        const isRight = select.value === pair.right;
        select.classList.toggle("is-correct", isRight);
        select.classList.toggle("is-incorrect", !isRight);
      });
    },
    disable() {
      selects.forEach((select) => {
        select.disabled = true;
      });
    }
  };
}

export { render };
