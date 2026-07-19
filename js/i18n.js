// i18n.js
// Quản lý ngôn ngữ giao diện: tải file locale, tra cứu chuỗi dịch theo key,
// chuyển đổi ngôn ngữ và ghi nhớ lựa chọn của người dùng.
// Nội dung bài học (data/lessons/*.json) không đi qua module này.

const SUPPORTED_LANGUAGES = ["en", "vi"];
const DEFAULT_LANGUAGE = "en";
const STORAGE_KEY = "preferredLanguage";

let currentLanguage = DEFAULT_LANGUAGE;
let translations = {};
const languageChangeListeners = [];

function getStoredLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
}

async function loadLocale(language) {
  const response = await fetch(`./locales/${language}.json`);
  if (!response.ok) {
    throw new Error("locale-not-found");
  }
  return response.json();
}

function getCurrentLanguage() {
  return currentLanguage;
}

function translate(key) {
  const value = key
    .split(".")
    .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), translations);
  return typeof value === "string" ? value : key;
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

function t(key) {
  return translate(key);
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
