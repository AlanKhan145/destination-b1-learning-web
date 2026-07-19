// app.js
// Điểm khởi động ứng dụng: đọc tham số ?lesson=, tải ngôn ngữ + dữ liệu bài học,
// dựng khung giao diện (header/footer/bộ chọn ngôn ngữ) và kết nối các module.

import { initI18n, setLanguage, getCurrentLanguage, t, onLanguageChange } from "./i18n.js";
import { loadLesson, loadLessonIndex, isValidLessonId } from "./lesson-loader.js";
import { renderLesson } from "./lesson-renderer.js";
import { renderHome } from "./home-renderer.js";
import { initNavigation, initScrollSpy } from "./navigation.js";
import { initReviewPanel, refreshReviewPanelLocale } from "./review-panel.js";
import { loadVocabularySet } from "./vocabulary/vocabulary-data.js";
import { renderVocabularyLesson } from "./vocabulary/vocabulary-lesson-renderer.js";
import { renderReviewLesson } from "./review-lesson-renderer.js";

const LANGUAGE_OPTIONS = [
  { code: "en", key: "language.english" },
  { code: "vi", key: "language.vietnamese" }
];

let currentLesson = null;
let currentLessonIndex = null;
let currentVocabularySet = null;

function isVocabularyLesson(lesson) {
  return lesson?.category === "Vocabulary";
}

function renderLessonBody() {
  if (isVocabularyLesson(currentLesson) && currentVocabularySet) {
    renderVocabularyLesson(currentLesson, currentVocabularySet);
  } else if (currentLesson?.category === "Review") {
    renderReviewLesson(currentLesson);
  } else {
    renderLesson(currentLesson);
  }
}

/** Trả về id bài học từ ?lesson=, hoặc null khi không có (nghĩa là hiển thị trang chủ). */
function getRequestedLessonId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("lesson");
}

function showLessonWorkspace() {
  const workspace = document.getElementById("workspace");
  const lessonList = document.getElementById("lesson-list");
  if (workspace) workspace.hidden = false;
  if (lessonList) lessonList.hidden = true;
}

function showLessonList() {
  const workspace = document.getElementById("workspace");
  const lessonList = document.getElementById("lesson-list");
  if (workspace) workspace.hidden = true;
  if (lessonList) lessonList.hidden = false;
}

function handleLanguageChange(language) {
  if (language === getCurrentLanguage()) return;
  setLanguage(language).catch((error) => console.error(error));
}

function renderSiteHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;
  header.innerHTML = "";

  const nav = document.createElement("nav");
  nav.className = "main-nav";

  const brand = document.createElement("a");
  brand.className = "brand";
  brand.href = "./index.html";
  brand.textContent = t("app.name");

  const switcher = document.createElement("div");
  switcher.className = "language-switcher";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", t("language.label"));

  const currentLanguage = getCurrentLanguage();

  LANGUAGE_OPTIONS.forEach(({ code, key }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "language-option";
    if (code === currentLanguage) button.classList.add("is-active");
    button.setAttribute("aria-pressed", String(code === currentLanguage));
    button.textContent = t(key);
    button.addEventListener("click", () => handleLanguageChange(code));
    switcher.appendChild(button);
  });

  nav.append(brand, switcher);
  header.appendChild(nav);
}

function renderSiteFooter() {
  const footer = document.getElementById("site-footer");
  if (!footer) return;
  footer.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "footer-inner";

  const text = document.createElement("p");
  text.className = "footer-text";
  text.textContent = t("app.footer");

  inner.appendChild(text);
  footer.appendChild(inner);
}

function renderChrome() {
  renderSiteHeader();
  renderSiteFooter();
  if (currentLesson) {
    document.title = `${currentLesson.title} – ${t("app.name")}`;
  } else if (currentLessonIndex) {
    document.title = `${t("home.title")} – ${t("app.name")}`;
  } else {
    document.title = t("app.name");
  }
}

function renderErrorMessage(messageKey, container) {
  if (!container) return;
  container.innerHTML = "";
  const message = document.createElement("p");
  message.className = "error-message";
  message.textContent = t(messageKey);
  container.appendChild(message);
}

function renderLessonErrorMessage(messageKey) {
  const contentContainer = document.getElementById("lesson-content");

  ["lesson-header", "table-of-contents", "lesson-pagination"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  renderErrorMessage(messageKey, contentContainer);
}

async function renderCurrentLesson() {
  if (!currentLesson) return;
  renderLessonBody();
  initScrollSpy();
  initReviewPanel(currentLesson);
}

/**
 * Ré-render sau khi đổi ngôn ngữ: chỉ cập nhật nhãn giao diện, không gọi lại
 * initReviewPanel() để không làm mất tiến trình ôn tập đang dang dở.
 */
function renderCurrentView() {
  if (currentLesson) {
    renderLessonBody();
    initScrollSpy();
    refreshReviewPanelLocale();
  } else if (currentLessonIndex) {
    renderHome(currentLessonIndex);
  }
}

async function bootstrap() {
  try {
    await initI18n();
  } catch (error) {
    console.error(error);
    document.title = "English Learning";
    return;
  }

  initNavigation();

  const requestedLessonId = getRequestedLessonId();

  if (!requestedLessonId) {
    showLessonList();
    try {
      currentLessonIndex = await loadLessonIndex();
    } catch (error) {
      console.error(error);
      renderChrome();
      renderErrorMessage("errors.unexpectedError", document.getElementById("lesson-list"));
      return;
    }

    renderChrome();
    renderHome(currentLessonIndex);
  } else if (!isValidLessonId(requestedLessonId)) {
    showLessonWorkspace();
    renderChrome();
    renderLessonErrorMessage("errors.lessonNotFound");
    return;
  } else {
    showLessonWorkspace();

    try {
      currentLesson = await loadLesson(requestedLessonId);
      if (isVocabularyLesson(currentLesson)) {
        currentVocabularySet = await loadVocabularySet(requestedLessonId);
      }
    } catch (error) {
      console.error(error);
      renderChrome();
      const messageKey =
        error.message === "lesson-not-found" || error.message === "vocabulary-not-found"
          ? "errors.lessonNotFound"
          : "errors.unexpectedError";
      renderLessonErrorMessage(messageKey);
      return;
    }

    renderChrome();
    await renderCurrentLesson();
  }

  onLanguageChange(() => {
    renderChrome();
    renderCurrentView();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((error) => console.error(error));
});
