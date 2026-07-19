// vocabulary-data.js
// Fetches data/vocabulary/{unitId}.json and normalizes its 5 sections into one
// flat list of reviewable entries. Mirrors question-loader.js's fetch+cache
// pattern. Nothing here is unit-3-specific — every function takes unitId.

const UNIT_ID_PATTERN = /^[a-z0-9-]+$/;
const setCache = new Map(); // unitId -> Promise<vocabularySet>

const SECTION_META = [
  { key: "topicVocabulary", sectionId: "topic-vocabulary", titleKey: "vocabulary.sections.topicVocabulary" },
  { key: "phrasalVerbs", sectionId: "phrasal-verbs", titleKey: "vocabulary.sections.phrasalVerbs" },
  { key: "prepositionalPhrases", sectionId: "prepositional-phrases", titleKey: "vocabulary.sections.prepositionalPhrases" },
  { key: "wordFormation", sectionId: "word-formation", titleKey: "vocabulary.sections.wordFormation" },
  { key: "wordPatterns", sectionId: "word-patterns", titleKey: "vocabulary.sections.wordPatterns" }
];

function isValidUnitId(unitId) {
  return typeof unitId === "string" && UNIT_ID_PATTERN.test(unitId);
}

async function fetchVocabularySet(unitId) {
  if (!isValidUnitId(unitId)) throw new Error("vocabulary-not-found");

  const response = await fetch(`./data/vocabulary/${unitId}.json`);
  if (response.status === 404) throw new Error("vocabulary-not-found");
  if (!response.ok) throw new Error("unexpected-error");

  return response.json();
}

/** Fetches (and caches in-memory) the vocabulary set for a unit. */
function loadVocabularySet(unitId) {
  if (!setCache.has(unitId)) {
    setCache.set(
      unitId,
      fetchVocabularySet(unitId).catch((error) => {
        setCache.delete(unitId); // don't cache a failed fetch
        throw error;
      })
    );
  }
  return setCache.get(unitId);
}

function displayTextFor(entry) {
  if (entry.type === "word-family") return entry.root;
  if (entry.type === "word-pattern") return entry.structure || entry.headword;
  return entry.word;
}

function searchTextFor(entry, displayText) {
  const parts = [displayText, entry.meaningVi, entry.definitionEn, entry.usageEn, entry.example?.en];
  if (entry.forms) parts.push(...entry.forms.map((form) => form.word));
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/**
 * Flattens the 5 sections of a vocabulary set into one array — one entry per
 * reviewable unit (a word-family group counts as ONE entry, not one per form).
 * Every flat entry keeps its original type-specific fields plus:
 *   sectionId, sectionTitleKey, displayText, searchText
 */
function getFlatEntries(vocabularySet) {
  const sections = vocabularySet.sections || {};
  const flat = [];

  for (const { key, sectionId, titleKey } of SECTION_META) {
    const raw = sections[key];
    let entries;

    if (key === "wordFormation") {
      entries = raw?.families || [];
    } else if (key === "wordPatterns") {
      entries = [...(raw?.adjectivePreposition || []), ...(raw?.verbPreposition || []), ...(raw?.nounPreposition || [])];
    } else {
      entries = raw || [];
    }

    for (const entry of entries) {
      const displayText = displayTextFor(entry);
      flat.push({
        ...entry,
        sectionId,
        sectionTitleKey: titleKey,
        displayText,
        searchText: searchTextFor(entry, displayText)
      });
    }
  }

  return flat;
}

export { loadVocabularySet, getFlatEntries, isValidUnitId, SECTION_META };
