// matching-engine.js
// One generic tap-to-pair matching renderer, parameterized by `pairs`. All 4
// matching variants (word↔meaning, word↔image, root↔form, adjective/verb↔
// preposition) are just different pair-builders feeding this one renderer —
// see buildMatchingPairs() in vocabulary-review-engine.js.

import { createElement, shuffle } from "../utils.js";

function makeContentNode(content, type) {
  if (type === "image") {
    return createElement("img", { className: "matching-image", attrs: { src: content, loading: "lazy", alt: "" } });
  }
  return createElement("span", { className: "matching-text", text: content });
}

/**
 * Renders a click-to-match grid: `pairs` is `[{ id, left, right, rightType? }]`
 * (`rightType: "image"` renders `right` as an image src instead of text; the
 * same option exists implicitly for `left` via `leftType`). Calls
 * `onComplete({ totalPairs, attempts })` once every pair has been matched.
 */
function renderMatching(pairs, container, { onComplete } = {}) {
  container.innerHTML = "";

  const leftItems = shuffle(pairs.map((p) => ({ id: p.id, content: p.left, type: p.leftType })));
  const rightItems = shuffle(pairs.map((p) => ({ id: p.id, content: p.right, type: p.rightType })));

  const grid = createElement("div", { className: "matching-grid" });
  const leftCol = createElement("ul", { className: "matching-column" });
  const rightCol = createElement("ul", { className: "matching-column" });

  const leftButtons = new Map();
  const rightButtons = new Map();
  const matchedIds = new Set();
  let selectedLeftId = null;
  let attempts = 0;

  function buildColumn(items, column, buttons, onClick) {
    items.forEach((item) => {
      const button = createElement("button", {
        className: "matching-button",
        attrs: { type: "button", "data-pair-id": item.id }
      });
      button.appendChild(makeContentNode(item.content, item.type));
      button.addEventListener("click", () => onClick(item.id, button));
      column.appendChild(createElement("li", { className: "matching-item" }, [button]));
      buttons.set(item.id, button);
    });
  }

  function clearSelection() {
    if (selectedLeftId) leftButtons.get(selectedLeftId)?.classList.remove("is-selected");
    selectedLeftId = null;
  }

  function handleLeftClick(id, button) {
    if (matchedIds.has(id)) return;
    clearSelection();
    selectedLeftId = id;
    button.classList.add("is-selected");
  }

  function handleRightClick(id, button) {
    if (matchedIds.has(id) || !selectedLeftId) return;
    attempts += 1;
    const leftId = selectedLeftId;

    if (leftId === id) {
      matchedIds.add(id);
      [leftButtons.get(id), button].forEach((el) => {
        el.classList.add("is-matched");
        el.disabled = true;
      });
      clearSelection();
      if (matchedIds.size === pairs.length) onComplete?.({ totalPairs: pairs.length, attempts });
    } else {
      const leftButton = leftButtons.get(leftId);
      button.classList.add("is-incorrect");
      leftButton?.classList.add("is-incorrect");
      setTimeout(() => {
        button.classList.remove("is-incorrect");
        leftButton?.classList.remove("is-incorrect");
      }, 400);
      clearSelection();
    }
  }

  buildColumn(leftItems, leftCol, leftButtons, handleLeftClick);
  buildColumn(rightItems, rightCol, rightButtons, handleRightClick);

  grid.append(leftCol, rightCol);
  container.appendChild(grid);
}

export { renderMatching };
