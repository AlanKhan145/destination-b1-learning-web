// i18n.js
// Quản lý ngôn ngữ giao diện: tải file locale, tra cứu chuỗi dịch theo key,
// chuyển đổi ngôn ngữ và ghi nhớ lựa chọn của người dùng.
// Nội dung bài học (data/lessons/*.json) không đi qua module này.

const SUPPORTED_LANGUAGES = ["en", "vi"];
const DEFAULT_LANGUAGE = "en";
const STORAGE_KEY = "preferredLanguage";
// Each namespace is its own file (locales/<lang>/<namespace>.json) so translators
// and future question types don't have to touch one giant locale file.
const NAMESPACES = ["common", "lesson", "review", "question-types", "result"];

let currentLanguage = DEFAULT_LANGUAGE;
let translations = {};
const languageChangeListeners = [];

function getStoredLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
}

async function loadLocale(language) {
  const responses = await Promise.all(
    NAMESPACES.map((namespace) => fetch(`./locales/${language}/${namespace}.json`))
  );

  if (responses.some((response) => !response.ok)) {
    throw new Error("locale-not-found");
  }

  const parts = await Promise.all(responses.map((response) => response.json()));
  return Object.assign({}, ...parts);
}

function getCurrentLanguage() {
  return currentLanguage;
}

/** Looks up a dotted key (e.g. "review.questionOf") and substitutes {param} placeholders. */
function translate(key, params) {
  const value = key
    .split(".")
    .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), translations);

  if (typeof value !== "string") return key;
  if (!params) return value;

  return value.replace(/\{(\w+)\}/g, (match, paramName) =>
    Object.prototype.hasOwnProperty.call(params, paramName) ? String(params[paramName]) : match
  );
}

function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translate(element.dataset.i18n);
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
  });

  document.documentElement.lang = currentLanguage;
}

function onLanguageChange(listener) {
  languageChangeListeners.push(listener);
}

async function setLanguage(language) {
  if (!SUPPORTED_LANGUAGES.includes(language) || language === currentLanguage) return;

  translations = await loadLocale(language);
  currentLanguage = language;
  localStorage.setItem(STORAGE_KEY, language);
  applyTranslations();

  languageChangeListeners.forEach((listener) => listener(currentLanguage));
}

async function initI18n() {
  const initialLanguage = getStoredLanguage() || DEFAULT_LANGUAGE;
  translations = await loadLocale(initialLanguage);
  currentLanguage = initialLanguage;
  applyTranslations();
}

function t(key, params) {
  return translate(key, params);
}

export {
  initI18n,
  loadLocale,
  setLanguage,
  getCurrentLanguage,
  translate,
  applyTranslations,
  onLanguageChange,
  t,
  SUPPORTED_LANGUAGES
};
