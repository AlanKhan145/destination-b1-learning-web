// lesson-loader.js
// Chịu trách nhiệm tải dữ liệu bài học (data/lessons/*.json).
// Chặn giá trị lessonId không hợp lệ trước khi tải để tránh đường dẫn không an toàn.

const LESSON_ID_PATTERN = /^[a-z0-9-]+$/;

function isValidLessonId(lessonId) {
  return typeof lessonId === "string" && LESSON_ID_PATTERN.test(lessonId);
}

async function loadLesson(lessonId) {
  if (!isValidLessonId(lessonId)) {
    throw new Error("lesson-not-found");
  }

  const response = await fetch(`./data/lessons/${lessonId}.json`);

  if (response.status === 404) {
    throw new Error("lesson-not-found");
  }

  if (!response.ok) {
    throw new Error("unexpected-error");
  }

  return response.json();
}

async function loadLessonIndex() {
  const response = await fetch("./data/lessons/index.json");

  if (!response.ok) {
    throw new Error("unexpected-error");
  }

  return response.json();
}

export { loadLesson, loadLessonIndex, isValidLessonId, LESSON_ID_PATTERN };
