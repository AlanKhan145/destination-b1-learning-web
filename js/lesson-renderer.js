// lesson-renderer.js
// Chịu trách nhiệm biến dữ liệu bài học (data/unit-*.js) thành giao diện HTML.
// Không chứa dữ liệu bài học cố định — mọi nội dung đều lấy từ tham số truyền vào.

/**
 * Tạo một phần tử DOM với class, thuộc tính và nội dung text tùy chọn.
 */
function createElement(tag, options = {}, children = []) {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
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
function fillCellContent(cellElement, cellValue) {
  if (Array.isArray(cellValue)) {
    cellValue.forEach((line) => {
      cellElement.appendChild(createElement("span", { className: "cell-line", text: line }));
    });
  } else {
    cellElement.textContent = cellValue;
  }
}

/**
 * Header của bài học: Unit, category, title, mô tả và danh sách tổng quan các chủ điểm.
 */
function renderLessonHeader(data) {
  const container = createElement("div", { className: "lesson-header-content" });

  const meta = createElement("div", { className: "lesson-meta" });
  meta.appendChild(createElement("span", { className: "lesson-unit-badge", text: `Unit ${data.unitNumber}` }));
  meta.appendChild(createElement("span", { className: "lesson-category", text: data.category }));
  container.appendChild(meta);

  container.appendChild(createElement("h1", { className: "lesson-title", text: data.title }));

  if (data.description) {
    container.appendChild(createElement("p", { className: "lesson-description", text: data.description }));
  }

  container.appendChild(createElement("p", { className: "topics-intro", text: "Các chủ điểm ngữ pháp trong bài:" }));
  container.appendChild(renderTopicsOverviewList(data.topics));

  return container;
}

/**
 * Danh sách tổng quan tất cả chủ điểm kèm trạng thái (đã có nội dung / sắp cập nhật).
 */
function renderTopicsOverviewList(topics) {
  const list = createElement("ul", { className: "topics-overview-list" });

  topics.forEach((topic) => {
    const item = createElement("li", { className: "topics-overview-item" });

    if (topic.status === "available") {
      const link = createElement("a", {
        className: "topics-overview-link",
        text: `${topic.number}. ${topic.title}`,
        attrs: { href: `#${topic.id}` }
      });
      item.appendChild(link);
      item.appendChild(createElement("span", { className: "status-badge status-badge--available", text: "Đã có nội dung" }));
    } else {
      item.appendChild(createElement("span", { className: "topics-overview-text", text: `${topic.number}. ${topic.title}` }));
      item.appendChild(createElement("span", { className: "status-badge status-badge--pending", text: "Sắp cập nhật" }));
    }

    list.appendChild(item);
  });

  return list;
}

/**
 * Mục lục điều hướng nhanh — chỉ hiển thị các chủ điểm đã có nội dung.
 */
function renderTopicNavigation(topics) {
  const nav = createElement("div", { className: "topic-nav-inner" });
  nav.appendChild(createElement("span", { className: "topic-nav-label", text: "Mục lục nhanh" }));

  const list = createElement("ul", { className: "topic-nav-list" });

  topics
    .filter((topic) => topic.status === "available")
    .forEach((topic) => {
      const item = createElement("li", { className: "topic-nav-item" });
      const link = createElement("a", {
        className: "topic-nav-link",
        text: topic.title,
        attrs: { href: `#${topic.id}`, "data-topic-id": topic.id }
      });
      item.appendChild(link);
      list.appendChild(item);
    });

  nav.appendChild(list);
  return nav;
}

/**
 * Hộp công thức (formula) — chỉ hiển thị khi formula có giá trị.
 */
function renderFormula(formula, formulaNote) {
  if (!formula) return null;

  const box = createElement("div", { className: "formula-box" });
  box.appendChild(createElement("p", { className: "formula-text", text: formula }));

  if (formulaNote) {
    box.appendChild(createElement("p", { className: "formula-note", text: formulaNote }));
  }

  return box;
}

/**
 * Bảng Form – Cấu trúc. Số cột và số dòng được tạo tự động từ dữ liệu.
 */
function renderFormTable(forms) {
  if (!forms || !forms.columns || !forms.columns.length) return null;

  const wrapper = createElement("div", { className: "table-wrapper" });
  const table = createElement("table", { className: "data-table form-table" });

  const thead = createElement("thead");
  const headerRow = createElement("tr");
  forms.columns.forEach((column) => {
    headerRow.appendChild(createElement("th", { text: column, attrs: { scope: "col" } }));
  });
  thead.appendChild(headerRow);

  const tbody = createElement("tbody");
  forms.rows.forEach((row) => {
    const tr = createElement("tr");
    row.forEach((cellValue, columnIndex) => {
      const isRowHeader = columnIndex === 0;
      const cellEl = createElement(isRowHeader ? "th" : "td", {
        attrs: isRowHeader ? { scope: "row" } : { "data-label": forms.columns[columnIndex] }
      });
      fillCellContent(cellEl, cellValue);
      tr.appendChild(cellEl);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

/**
 * Bảng Uses – Cách sử dụng. Ví dụ tiếng Anh được làm nổi bật hơn phần mô tả,
 * và các từ chỉ định trong `highlight` được đánh dấu bằng <mark>.
 */
function renderUsesTable(uses) {
  if (!uses || !uses.length) return null;

  const wrapper = createElement("div", { className: "table-wrapper" });
  const table = createElement("table", { className: "data-table uses-table" });

  const thead = createElement("thead");
  const headerRow = createElement("tr");
  ["Cách sử dụng", "Ví dụ"].forEach((column) => {
    headerRow.appendChild(createElement("th", { text: column, attrs: { scope: "col" } }));
  });
  thead.appendChild(headerRow);

  const tbody = createElement("tbody");
  uses.forEach((use) => {
    const tr = createElement("tr");

    const usageCell = createElement("td", {
      className: "use-description",
      text: use.usage,
      attrs: { "data-label": "Cách sử dụng" }
    });

    const exampleCell = createElement("td", {
      className: "use-example",
      attrs: { "data-label": "Ví dụ" }
    });
    exampleCell.appendChild(highlightWords(use.example, use.highlight || []));

    tr.append(usageCell, exampleCell);
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

/**
 * Hộp lưu ý (Watch out!). Không hiển thị gì nếu `notes` rỗng.
 */
function renderNotes(notes) {
  if (!notes || !notes.length) return null;

  const container = createElement("div", { className: "notes-container" });

  notes.forEach((note) => {
    const box = createElement("div", { className: "note-box", attrs: { role: "note" } });
    box.appendChild(createElement("p", { className: "note-title", text: note.title }));

    (note.paragraphs || []).forEach((paragraph) => {
      box.appendChild(createElement("p", { className: "note-paragraph", text: paragraph }));
    });

    (note.examples || []).forEach((example) => {
      const exampleEl = createElement("p", { className: "note-example" });
      exampleEl.appendChild(highlightWords(example.en, example.highlight || []));
      box.appendChild(exampleEl);
    });

    container.appendChild(box);
  });

  return container;
}

/**
 * Section cho chủ điểm chưa có nội dung, hiển thị nhãn "Sắp cập nhật".
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
  titleRow.appendChild(createElement("span", { className: "status-badge status-badge--pending", text: "Sắp cập nhật" }));
  section.appendChild(titleRow);

  section.appendChild(
    createElement("p", {
      className: "coming-soon-text",
      text: "Nội dung của phần này đang được biên soạn và sẽ sớm được cập nhật."
    })
  );

  return section;
}

/**
 * Section đầy đủ cho một chủ điểm ngữ pháp đã có nội dung.
 * Tự động gọi renderComingSoonTopic nếu chủ điểm chưa sẵn sàng.
 */
function renderGrammarTopic(topic) {
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

  const formulaEl = renderFormula(topic.formula, topic.formulaNote);
  if (formulaEl) section.appendChild(formulaEl);

  const formTableEl = renderFormTable(topic.forms);
  if (formTableEl) {
    section.appendChild(createElement("h4", { className: "subsection-title", text: "Form – Cấu trúc" }));
    section.appendChild(formTableEl);
  }

  const usesTableEl = renderUsesTable(topic.uses);
  if (usesTableEl) {
    section.appendChild(createElement("h4", { className: "subsection-title", text: "Uses – Cách sử dụng" }));
    section.appendChild(usesTableEl);
  }

  const notesEl = renderNotes(topic.notes);
  if (notesEl) section.appendChild(notesEl);

  return section;
}

/**
 * Hàm tổng: nhận dữ liệu bài học và render toàn bộ nội dung vào các vùng
 * #lesson-header, #topic-navigation, #lesson-content trong index.html.
 */
function renderLesson(data) {
  const headerContainer = document.getElementById("lesson-header");
  const navContainer = document.getElementById("topic-navigation");
  const contentContainer = document.getElementById("lesson-content");

  if (!headerContainer || !navContainer || !contentContainer) {
    console.error("Không tìm thấy vùng giao diện bài học trong DOM.");
    return;
  }

  headerContainer.appendChild(renderLessonHeader(data));
  navContainer.appendChild(renderTopicNavigation(data.topics));

  data.topics.forEach((topic) => {
    contentContainer.appendChild(renderGrammarTopic(topic));
  });
}

export {
  renderLesson,
  renderLessonHeader,
  renderTopicNavigation,
  renderGrammarTopic,
  renderFormTable,
  renderUsesTable,
  renderFormula,
  renderNotes,
  renderComingSoonTopic
};
