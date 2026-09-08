export type ReadingSourceType = "txt" | "docx" | "pdf";
export type ReadingMode = "reading" | "listening";

export interface ReadingDocument {
  id: string;
  title: string;
  content: string;
  sourceType: ReadingSourceType;
  mode: ReadingMode;
  createdAt: number;
}

const MAX_DOCUMENTS = 8;
const MAX_CHARACTERS = 350_000;

function storageKey(username: string): string {
  return `pet-reading-documents-v1-${username}`;
}

export function loadReadingDocuments(username: string): ReadingDocument[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(username)) ?? "[]") as Array<ReadingDocument & { mode?: ReadingMode }>;
    return Array.isArray(parsed) ? parsed.map((document) => ({ ...document, mode: document.mode ?? "reading" })) : [];
  } catch {
    return [];
  }
}

export function saveReadingDocument(username: string, document: ReadingDocument): ReadingDocument[] {
  const current = loadReadingDocuments(username).filter((item) => item.id !== document.id);
  const next = [document, ...current].slice(0, MAX_DOCUMENTS);
  localStorage.setItem(storageKey(username), JSON.stringify(next));
  return next;
}

export function removeReadingDocument(username: string, id: string): ReadingDocument[] {
  const next = loadReadingDocuments(username).filter((item) => item.id !== id);
  localStorage.setItem(storageKey(username), JSON.stringify(next));
  return next;
}

function cleanText(text: string): string {
  return text
    .split("\u0000").join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseReadingFile(file: File, mode: ReadingMode = "reading"): Promise<ReadingDocument> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let content: string;
  let sourceType: ReadingSourceType;

  if (extension === "txt") {
    sourceType = "txt";
    content = await file.text();
  } else if (extension === "docx") {
    sourceType = "docx";
    const [mammoth, arrayBuffer] = await Promise.all([import("mammoth"), file.arrayBuffer()]);
    const result = await mammoth.extractRawText({ arrayBuffer });
    content = result.value;
  } else if (extension === "pdf") {
    sourceType = "pdf";
    const [pdfjs, workerModule, arrayBuffer] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      file.arrayBuffer(),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push(textContent.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    content = pages.join("\n\n");
  } else {
    throw new Error("只支持 TXT、DOCX 和 PDF 文件。");
  }

  const cleaned = cleanText(content);
  if (!cleaned) throw new Error("没有从文件中读取到文字。扫描版 PDF 需要以后增加 OCR。 ");
  if (cleaned.length > MAX_CHARACTERS) throw new Error("文档内容过长，请先拆分为较小文件。");

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: file.name.replace(/\.(txt|docx|pdf)$/i, ""),
    content: cleaned,
    sourceType,
    mode,
    createdAt: Date.now(),
  };
}

export function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return normalized.match(/[^.!?。！？]+[.!?。！？]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [normalized];
}
