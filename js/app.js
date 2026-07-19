// app.js
// Tải dữ liệu bài học, gọi renderer, và khởi tạo các thành phần giao diện chung
// (header, footer, thanh tiến độ, nút quay lại đầu trang, mục lục cuộn mượt, scroll spy).

import lessonData from "../data/unit-1.js";
import { renderLesson } from "./lesson-renderer.js";

const BACK_TO_TOP_THRESHOLD = 400;

function renderSiteHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;

  const nav = document.createElement("nav");
  nav.className = "main-nav";
  nav.setAttribute("aria-label", "Điều hướng chính");

  const brand = document.createElement("a");
  brand.className = "brand";
  brand.href = "#";
  brand.textContent = "English Grammar Learning";

  const levelBadge = document.createElement("span");
  levelBadge.className = "level-badge";
  levelBadge.textContent = "Trình độ B1";

  nav.append(brand, levelBadge);
  header.appendChild(nav);
}

function renderSiteFooter() {
  const footer = document.getElementById("site-footer");
  if (!footer) return;

  const inner = document.createElement("div");
  inner.className = "footer-inner";

  const text = document.createElement("p");
  text.className = "footer-text";
  text.textContent = "© 2026 English Grammar Learning. Tài liệu tham khảo: Destination Grammar and Vocabulary.";

  inner.appendChild(text);
  footer.appendChild(inner);
}

function renderLessonPagination() {
  const container = document.getElementById("lesson-pagination");
  if (!container) return;

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "pagination-button pagination-button--prev";
  prevButton.textContent = "← Bài trước";
  prevButton.disabled = true;
  prevButton.setAttribute("aria-label", "Bài trước (chưa có bài học nào trước Unit 1)");

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "pagination-button pagination-button--next";
  nextButton.textContent = "Bài tiếp theo →";
  nextButton.disabled = true;
  nextButton.setAttribute("aria-label", "Bài tiếp theo (chưa được cập nhật)");

  container.append(prevButton, nextButton);
}

/**
 * Thanh tiến độ đọc bài — độ rộng phản ánh tỉ lệ cuộn trang hiện tại.
 */
function initReadingProgress() {
  const progressBar = document.getElementById("reading-progress");
  if (!progressBar) return;

  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;

    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute("aria-valuenow", String(Math.round(progress)));
  }

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
}

/**
 * Nút quay lại đầu trang, chỉ hiện khi đã cuộn qua một ngưỡng nhất định.
 */
function initBackToTop() {
  const button = document.getElementById("back-to-top");
  if (!button) return;

  function toggleVisibility() {
    button.hidden = window.scrollY <= BACK_TO_TOP_THRESHOLD;
  }

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", toggleVisibility, { passive: true });
  toggleVisibility();
}

/**
 * Cuộn mượt đến section tương ứng khi bấm vào liên kết trong mục lục nhanh.
 */
function initSmoothScrollNavigation() {
  const nav = document.getElementById("topic-navigation");
  if (!nav) return;

  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-topic-id]");
    if (!link) return;

    const targetSection = document.getElementById(link.dataset.topicId);
    if (!targetSection) return;

    event.preventDefault();
    targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/**
 * Làm nổi bật mục đang được đọc trong mục lục nhanh khi người dùng cuộn trang.
 */
function initScrollSpy() {
  const navLinks = document.querySelectorAll(".topic-nav-link");
  if (!navLinks.length) return;

  const sections = Array.from(navLinks)
    .map((link) => document.getElementById(link.dataset.topicId))
    .filter(Boolean);

  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => link.classList.remove("is-active"));
        const activeLink = document.querySelector(`.topic-nav-link[data-topic-id="${entry.target.id}"]`);
        if (activeLink) activeLink.classList.add("is-active");
      });
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
}

function initApp() {
  renderSiteHeader();
  renderLesson(lessonData);
  renderLessonPagination();
  renderSiteFooter();

  initReadingProgress();
  initBackToTop();
  initSmoothScrollNavigation();
  initScrollSpy();
}

document.addEventListener("DOMContentLoaded", initApp);
