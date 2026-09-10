import { PET_STUDY_WORDS, type PetWord } from "./pet-words";
import type { B1Word } from "./pet-lexicons";

export function asStudyWord(word: B1Word, index: number): PetWord {
  const core = PET_STUDY_WORDS.find(item => item.word.toLowerCase() === word.word.toLowerCase());
  if (core) return core;
  return { id: 1000 + index, word: word.word, category: "扩展词库", ipa: word.phonetic,
    partOfSpeech: word.part_of_speech, meaning: word.translation_cn, syllables: [word.word],
    stress: "请结合音标和完整发音记忆", phonics: "扩展词库暂未提供人工校对的音节拆分。",
    example: word.examples[0]?.sentence ?? word.word, translation: word.examples[0]?.translation_cn ?? word.translation_cn };
}

export function studyPool(saved: PetWord[] = []): PetWord[] {
  return [...PET_STUDY_WORDS, ...saved.filter(word => !PET_STUDY_WORDS.some(core => core.id === word.id))];
}

export function readSavedWords(value: unknown): PetWord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((word): word is PetWord => word && Number.isInteger(word.id) && word.id >= 1000
    && [word.word, word.ipa, word.meaning, word.partOfSpeech, word.stress, word.phonics, word.example, word.translation].every(item => typeof item === "string")
    && word.category === "扩展词库" && Array.isArray(word.syllables) && word.syllables.every((part: unknown) => typeof part === "string"));
}
