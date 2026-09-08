export interface B1Example {
  sentence: string;
  translation_cn: string;
}

export interface B1Word {
  word: string;
  translation_cn: string;
  part_of_speech: string;
  phonetic: string;
  cefr_level: string;
  difficulty_level: number;
  examples: B1Example[];
}

interface B1WordListFile {
  name: string;
  description: string;
  words: B1Word[];
}

let cachedB1Words: B1Word[] | null = null;

export async function loadB1Words(): Promise<B1Word[]> {
  if (cachedB1Words) return cachedB1Words;
  const response = await fetch(`${import.meta.env.BASE_URL}data/cefr-b1.json`);
  if (!response.ok) throw new Error("扩展词库加载失败");
  const data = await response.json() as B1WordListFile;
  cachedB1Words = data.words;
  return data.words;
}
