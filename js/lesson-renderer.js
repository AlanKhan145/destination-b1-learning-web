// lesson-renderer.js
// Biến dữ liệu bài học (data/lessons/*.json) thành giao diện HTML.
// Mọi nhãn giao diện lấy từ t() (js/i18n.js); mọi nội dung kiến thức lấy từ tham số `lesson`/`topic`.
// Không chứa logic riêng cho từng chủ điểm cụ thể — chỉ dựa vào cấu trúc dữ liệu.

import { t } from "./i18n.js";

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

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Trả về một DocumentFragment với các từ trong `words` được bọc trong <mark>.
 */
function highlightWords(text, words = []) {
  const fragment = document.createDocumentFragment();

  if (!words.length) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  parts.forEach((part) => {
    if (!part) return;
    const isHighlighted = words.some((word) => word.toLowerCase() === part.toLowerCase());
    if (isHighlighted) {
      fragment.appendChild(createElement("mark", { className: "highlight-word", text: part }));
    } else {
      fragment.appendChild(document.createTextNode(part));
    }
  });

  return fragment;
}

/**
 * Điền nội dung một ô bảng, hỗ trợ cả chuỗi đơn và mảng nhiều dòng.
 */
function fillMultilineCell(cellElement, cellValue) {
  if (Array.isArray(cellValue)) {
    cellValue.forEach((line) => {
      cellElement.appendChild(createElement("span", { className: "cell-line", text: line }));
    });
  } else {
    cellElement.textContent = cellValue;
  }
}

/**
 * Chuyển "watch-out" -> "watchOut" để tra key `lesson.<noteType>` trong locale.
 */
function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function renderStatusBadge(status) {
  const isAvailable = status === "available";
  const key = isAvailable ? "status.available" : "status.comingSoon";
  const modifier = isAvailable ? "available" : "pending";
  return createElement("span", { className: `status-badge status-badge--${modifier}`, text: t(key) });
}

/**
 * Danh sách tổng quan tất cả chủ điểm kèm trạng thái.
 */
function renderTopicList(topics) {
  const list = createElement("ul", { className: "topics-overview-list" });

  topics.forEach((topic) => {
    const item = createElement("li", { className: "topics-overview-item" });

    if (topic.status === "available") {
      item.appendChild(
        createElement("a", {
          className: "topics-overview-link",
          text: `${topic.number}. ${topic.title}`,
          attrs: { href: `#${topic.id}` }
        })
      );
    } else {
      item.appendChild(
        createElement("span", { className: "topics-overview-text", text: `${topic.number}. ${topic.title}` })
      );
    }

    item.appendChild(renderStatusBadge(topic.status));
    list.appendChild(item);
  });

  return list;
}

/**
 * Header của bài học: Unit, category, title, mô tả và danh sách tổng quan chủ điểm.
 */
function renderLessonHeader(lesson) {
  const container = createElement("div", { className: "lesson-header-content" });

  const meta = createElement("div", { className: "lesson-meta" });
  meta.appendChild(
    createElement("span", { className: "lesson-unit-badge", text: `${t("lesson.unit")} ${lesson.unitNumber}` })
  );
  meta.appendChild(
    createElement("span", { className: "lesson-category", text: t(`lesson.${lesson.category.toLowerCase()}`) })
  );
  container.appendChild(meta);

  container.appendChild(createElement("h1", { className: "lesson-title", text: lesson.title }));

  if (lesson.description) {
    container.appendChild(createElement("p", { className: "lesson-description", text: lesson.description }));
  }

  container.appendChild(createElement("p", { className: "topics-intro", text: t("lesson.topicsInLesson") }));
  container.appendChild(renderTopicList(lesson.topics));

  return container;
}

/**
 * Mục lục điều hướng nhanh — chỉ hiển thị các chủ điểm đã có nội dung.
 */
function renderTableOfContents(topics) {
  const wrapper = createElement("div", { className: "toc-inner" });
  wrapper.appendChild(createElement("span", { className: "toc-label", text: t("lesson.tableOfContents") }));

  const list = createElement("ul", { className: "toc-list" });
  topics
    .filter((topic) => topic.status === "available")
    .forEach((topic) => {
      const item = createElement("li", { className: "toc-item" });
      item.appendChild(
        createElement("a", {
          className: "toc-link",
          text: topic.title,
          attrs: { href: `#${topic.id}`, "data-topic-id": topic.id }
        })
      );
      list.appendChild(item);
    });

  wrapper.appendChild(list);
  return wrapper;
}

/**
 * Hộp công thức — chỉ hiển thị khi topic.formula có giá trị.
 */
function renderFormula(formula) {
  if (!formula) return null;

  const box = createElement("div", { className: "formula-box" });
  box.appendChild(createElement("p", { className: "formula-label", text: t("lesson.formula") }));
  box.appendChild(createElement("p", { className: "formula-text", text: formula }));
  return box;
}

/**
 * Bảng Form. Số cột/số dòng tự động theo dữ liệu; cột "Type" luôn lấy từ locale.
 */
function renderFormTable(forms) {
  if (!forms || !forms.columns || !forms.rows || !forms.rows.length) return null;

  const wrapper = createElement("div", { className: "table-wrapper" });
  const table = createElement("table", { className: "data-table form-table" });

  const thead = createElement("thead");
  const headerRow = createElement("tr");
  headerRow.appendChild(createElement("th", { text: t("lesson.type"), attrs: { scope: "col" } }));
  forms.columns.forEach((column) => {
    headerRow.appendChild(createElement("th", { text: column, attrs: { scope: "col" } }));
  });
  thead.appendChild(headerRow);

  const tbody = createElement("tbody");
  forms.rows.forEach((row) => {
    const tr = createElement("tr");
    tr.appendChild(createElement("th", { text: row.label, attrs: { scope: "row" } }));

    row.cells.forEach((cellValue, columnIndex) => {
      const td = createElement("td", { attrs: { "data-label": forms.columns[columnIndex] || "" } });
      fillMultilineCell(td, cellValue);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

/**
 * Bảng Uses. Ví dụ tiếng Anh được làm nổi bật; highlightWords (nếu có) được đánh dấu bằng <mark>.
 */
function renderUsesTable(uses) {
  if (!uses || !uses.length) return null;

  const wrapper = createElement("div", { className: "table-wrapper" });
  const table = createElement("table", { className: "data-table uses-table" });

  const usageLabel = t("lesson.usage");
  const exampleLabel = t("lesson.example");

  const thead = createElement("thead");
  const headerRow = createElement("tr");
  headerRow.appendChild(createElement("th", { text: usageLabel, attrs: { scope: "col" } }));
  headerRow.appendChild(createElement("th", { text: exampleLabel, attrs: { scope: "col" } }));
  thead.appendChild(headerRow);

  const tbody = createElement("tbody");
  uses.forEach((use) => {
    const tr = createElement("tr");

    tr.appendChild(
      createElement("td", { className: "use-description", text: use.usage, attrs: { "data-label": usageLabel } })
    );

    const exampleCell = createElement("td", { className: "use-example", attrs: { "data-label": exampleLabel } });
    exampleCell.appendChild(highlightWords(use.example, use.highlightWords || []));
    tr.appendChild(exampleCell);

    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

/**
 * Hộp lưu ý (vd. Watch out!). Không hiển thị gì nếu `notes` rỗng.
 */
function renderNotes(notes) {
  if (!notes || !notes.length) return null;

  const container = createElement("div", { className: "notes-container" });

  notes.forEach((note) => {
    const box = createElement("div", { className: "note-box", attrs: { role: "note" } });
    const highlightList = note.highlightWords || [];

    box.appendChild(createElement("p", { className: "note-title", text: t(`lesson.${toCamelCase(note.type)}`) }));

    const contentEl = createElement("p", { className: "note-paragraph" });
    contentEl.appendChild(highlightWords(note.content, highlightList));
    box.appendChild(contentEl);

    (note.examples || []).forEach((example) => {
      const exampleEl = createElement("p", { className: "note-example" });
      exampleEl.appendChild(highlightWords(example, highlightList));
      box.appendChild(exampleEl);
    });

    container.appendChild(box);
  });

  return container;
}

/**
 * Section cho chủ điểm chưa có nội dung.
 */
function renderComingSoonTopic(topic) {
  const section = createElement("section", {
    className: "grammar-topic grammar-topic--coming-soon",
    attrs: { id: topic.id, "aria-labelledby": `${topic.id}-title` }
  });

  const titleRow = createElement("div", { className: "topic-title-row" });
  titleRow.appendChild(
    createElement("h3", {
      className: "topic-title",
      text: `${topic.number}. ${topic.title}`,
      attrs: { id: `${topic.id}-title` }
    })
  );
  titleRow.appendChild(renderStatusBadge(topic.status));
  section.appendChild(titleRow);

  section.appendChild(createElement("p", { className: "coming-soon-text", text: t("lesson.comingSoon") }));

  return section;
}

/**
 * Section đầy đủ cho một chủ điểm ngữ pháp. Không có logic riêng theo topic.id —
 * chỉ dựa vào các trường formula/forms/uses/notes có mặt hay không.
 */
function renderTopic(topic) {
  if (topic.status !== "available") {
    return renderComingSoonTopic(topic);
  }

  const section = createElement("section", {
    className: "grammar-topic",
    attrs: { id: topic.id, "aria-labelledby": `${topic.id}-title` }
  });

  section.appendChild(
    createElement("h3", {
      className: "topic-title",
      text: `${topic.number}. ${topic.title}`,
      attrs: { id: `${topic.id}-title` }
    })
  );

  if (topic.description) {
    section.appendChild(createElement("p", { className: "topic-description", text: topic.description }));
  }

  const formulaEl = renderFormula(topic.formula);
  if (formulaEl) section.appendChild(formulaEl);

  const formTableEl = renderFormTable(topic.forms);
  if (formTableEl) {
    section.appendChild(createElement("h4", { className: "subsection-title", text: t("lesson.form") }));
    section.appendChild(formTableEl);
  }

  const usesTableEl = renderUsesTable(topic.uses);
  if (usesTableEl) {
    section.appendChild(createElement("h4", { className: "subsection-title", text: t("lesson.uses") }));
    section.appendChild(usesTableEl);
  }

  const notesEl = renderNotes(topic.notes);
  if (notesEl) section.appendChild(notesEl);

  const practiceButton = renderPracticeTopicButton(topic);
  if (practiceButton) section.appendChild(practiceButton);

  return section;
}

/**
 * "Practice this topic" button (spec section 18). Only rendered when the topic
 * opts in via topic.review.enabled — review-panel.js listens for clicks on
 * [data-practice-topic] via event delegation, so no direct coupling is needed here.
 */
function renderPracticeTopicButton(topic) {
  if (!topic.review?.enabled) return null;

  const filter = topic.review.questionFilter || {};
  const button = createElement("button", {
    className: "practice-topic-button",
    text: t("review.practiceTopic"),
    attrs: {
      type: "button",
      "data-practice-topic": "true",
      "data-unit-id": filter.unitId || "",
      "data-topic-id": filter.topicIds?.[0] || topic.id
    }
  });

  return button;
}

/**
 * Nút "Bài trước" / "Bài tiếp theo". Vô hiệu hóa khi lesson không khai báo id tương ứng.
 */
function renderLessonNavigation(lesson) {
  const container = createElement("div", { className: "lesson-pagination-inner" });

  const previousId = lesson.previousLessonId || null;
  const nextId = lesson.nextLessonId || null;

  const previousButton = createElement(previousId ? "a" : "button", {
    className: "pagination-button pagination-button--prev",
    text: t("navigation.previousLesson"),
    attrs: previousId
      ? { href: `./index.html?lesson=${previousId}` }
      : { type: "button", disabled: "disabled", "aria-disabled": "true" }
  });

  const nextButton = createElement(nextId ? "a" : "button", {
    className: "pagination-button pagination-button--next",
    text: t("navigation.nextLesson"),
    attrs: nextId
      ? { href: `./index.html?lesson=${nextId}` }
      : { type: "button", disabled: "disabled", "aria-disabled": "true" }
  });

  container.append(previousButton, nextButton);
  return container;
}

/**
 * Hàm tổng: nhận dữ liệu bài học và render toàn bộ nội dung vào các vùng
 * #lesson-header, #table-of-contents, #lesson-content, #lesson-pagination trong index.html.
 * Có thể gọi lại nhiều lần (ví dụ sau khi đổi ngôn ngữ) — mỗi lần sẽ xóa nội dung cũ trước khi render.
 */
function renderLesson(lesson) {
  const headerContainer = document.getElementById("lesson-header");
  const tocContainer = document.getElementById("table-of-contents");
  const contentContainer = document.getElementById("lesson-content");
  const paginationContainer = document.getElementById("lesson-pagination");

  if (!headerContainer || !tocContainer || !contentContainer || !paginationContainer) {
    console.error("Không tìm thấy vùng giao diện bài học trong DOM.");
    return;
  }

  headerContainer.innerHTML = "";
  headerContainer.appendChild(renderLessonHeader(lesson));

  tocContainer.innerHTML = "";
  tocContainer.setAttribute("aria-label", t("lesson.tableOfContents"));
  tocContainer.appendChild(renderTableOfContents(lesson.topics));

  contentContainer.innerHTML = "";
  lesson.topics.forEach((topic) => {
    contentContainer.appendChild(renderTopic(topic));
  });

  paginationContainer.innerHTML = "";
  paginationContainer.setAttribute("aria-label", t("navigation.paginationLabel"));
  paginationContainer.appendChild(renderLessonNavigation(lesson));
}

export {
  renderLesson,
  renderLessonHeader,
  renderTopicList,
  renderTableOfContents,
  renderTopic,
  renderFormula,
  renderFormTable,
  renderUsesTable,
  renderNotes,
  renderComingSoonTopic,
  renderLessonNavigation,
  renderPracticeTopicButton
};
