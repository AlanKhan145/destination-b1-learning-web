// utils.js
// Small helpers shared across the review engine and question renderers.

/** Fisher-Yates shuffle. Returns a new array; does not mutate the input. */
function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createElement(tag, options = {}, children = []) {
  const element = document.createElement(tag);

  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => element.setAttribute(key, value));
  }

  children.forEach((child) => {
    if (child) element.appendChild(child);
  });

  return element;
}

export { shuffle, createElement };
