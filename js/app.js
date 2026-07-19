// app.js
// Điểm khởi động ứng dụng: đọc tham số ?lesson=, tải ngôn ngữ + dữ liệu bài học,
// dựng khung giao diện (header/footer/bộ chọn ngôn ngữ) và kết nối các module.

import { initI18n, setLanguage, getCurrentLanguage, t, onLanguageChange } from "./i18n.js";
import { loadLesson, isValidLessonId } from "./lesson-loader.js";
import { renderLesson } from "./lesson-renderer.js";
import { initNavigation, initScrollSpy } from "./navigation.js";

const DEFAULT_LESSON_ID = "unit-1";
const LANGUAGE_OPTIONS = [
  { code: "en", key: "language.english" },
  { code: "vi", key: "language.vietnamese" }
];

let currentLesson = null;

function getRequestedLessonId() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("lesson");
  return requested && isValidLessonId(requested) ? requested : DEFAULT_LESSON_ID;
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
  document.title = currentLesson ? `${currentLesson.title} – ${t("app.name")}` : t("app.name");
}

function renderErrorMessage(messageKey) {
  const contentContainer = document.getElementById("lesson-content");
  if (!contentContainer) return;

  ["lesson-header", "table-of-contents", "lesson-pagination"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  contentContainer.innerHTML = "";
  const message = document.createElement("p");
  message.className = "error-message";
  message.textContent = t(messageKey);
  contentContainer.appendChild(message);
}

async function renderCurrentLesson() {
  if (!currentLesson) return;
  renderLesson(currentLesson);
  initScrollSpy();
}

async function bootstrap() {
  try {
    await initI18n();
  } catch (error) {
    console.error(error);
    document.title = "English Learning";
    return;
  }

  const lessonId = getRequestedLessonId();

  try {
    currentLesson = await loadLesson(lessonId);
  } catch (error) {
    console.error(error);
    renderChrome();
    const messageKey = error.message === "lesson-not-found" ? "errors.lessonNotFound" : "errors.unexpectedError";
    renderErrorMessage(messageKey);
    return;
  }

  renderChrome();
  await renderCurrentLesson();
  initNavigation();

  onLanguageChange(async () => {
    renderChrome();
    await renderCurrentLesson();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((error) => console.error(error));
});
