// pronounce.js
// Thin wrapper over the browser's built-in speech synthesis for the "Listen"
// button — no audio assets, no new dependency. Degrades silently if unsupported.

function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function speak(text) {
  if (!isSpeechSupported() || !text) return;

  window.speechSynthesis.cancel(); // don't queue/overlap if the button is clicked repeatedly
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

export { speak, isSpeechSupported };
