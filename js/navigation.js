// navigation.js
// Xử lý tương tác điều hướng của trang: cuộn đến từng chủ điểm từ mục lục,
// đánh dấu mục đang đọc, thanh tiến độ đọc bài, nút quay lại đầu trang,
// và tab Lesson/Review trên mobile (desktop hiển thị hai cột cạnh nhau, xem css).
import { t } from "./i18n.js";

const BACK_TO_TOP_THRESHOLD = 400;

let scrollSpyObserver = null;

function initReadingProgress() {
  const progressBar = document.getElementById("reading-progress");
  if (!progressBar) return;

  function update() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;

    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute("aria-valuenow", String(Math.round(progress)));
  }

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

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
 * Cuộn mượt đến section tương ứng khi bấm vào liên kết trong mục lục.
 * Dùng event delegation trên container nên chỉ cần gắn một lần duy nhất,
 * kể cả khi danh sách liên kết bên trong được render lại.
 */
function initTableOfContentsScroll() {
  const nav = document.getElementById("table-of-contents");
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
 * Làm nổi bật mục đang được đọc trong mục lục khi cuộn trang.
 * Phải gọi lại mỗi khi #lesson-content được render lại (đổi ngôn ngữ),
 * vì các section cũ bị hủy và section mới được tạo ra.
 */
function initScrollSpy() {
  if (scrollSpyObserver) {
    scrollSpyObserver.disconnect();
    scrollSpyObserver = null;
  }

  const links = document.querySelectorAll(".toc-link");
  if (!links.length) return;

  const sections = Array.from(links)
    .map((link) => document.getElementById(link.dataset.topicId))
    .filter(Boolean);

  if (!sections.length) return;

  scrollSpyObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove("is-active"));
        const activeLink = document.querySelector(`.toc-link[data-topic-id="${entry.target.id}"]`);
        if (activeLink) activeLink.classList.add("is-active");
      });
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
  );

  sections.forEach((section) => scrollSpyObserver.observe(section));
}

/**
 * Tab "Bài học / Ôn tập" chỉ hiển thị trên mobile (xem media query trong css/styles.css);
 * trên desktop, workspace hiển thị hai cột cạnh nhau nên #workspace-tabs bị ẩn qua CSS.
 * Gọi lại hàm này (từ review-panel.js) mỗi khi biết bài học có bật review hay không.
 */
function setWorkspaceTabsEnabled(enabled) {
  const tabs = document.getElementById("workspace-tabs");
  const workspace = document.getElementById("workspace");
  if (!tabs || !workspace) return;

  if (!enabled) {
    tabs.hidden = true;
    workspace.removeAttribute("data-active-pane");
    return;
  }

  tabs.hidden = false;
  tabs.innerHTML = "";
  if (!workspace.dataset.activePane) workspace.dataset.activePane = "lesson";

  [
    { pane: "lesson", labelKey: "lesson.tabLesson" },
    { pane: "review", labelKey: "lesson.tabReview" }
  ].forEach(({ pane, labelKey }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-tab";
    button.textContent = t(labelKey);
    button.setAttribute("aria-pressed", String(workspace.dataset.activePane === pane));
    if (workspace.dataset.activePane === pane) button.classList.add("is-active");
    button.addEventListener("click", () => {
      workspace.dataset.activePane = pane;
      tabs.querySelectorAll(".workspace-tab").forEach((tabButton) => tabButton.classList.remove("is-active"));
      button.classList.add("is-active");
      tabs.querySelectorAll(".workspace-tab").forEach((tabButton) =>
        tabButton.setAttribute("aria-pressed", String(tabButton === button))
      );
    });
    tabs.appendChild(button);
  });
}

/**
 * Khởi tạo các thành phần điều hướng có vòng đời cố định (chạy một lần khi tải trang).
 * initScrollSpy() cần được gọi lại riêng sau mỗi lần renderLesson().
 */
function initNavigation() {
  initReadingProgress();
  initBackToTop();
  initTableOfContentsScroll();
  initScrollSpy();
}

export {
  initNavigation,
  initScrollSpy,
  initReadingProgress,
  initBackToTop,
  initTableOfContentsScroll,
  setWorkspaceTabsEnabled
};
