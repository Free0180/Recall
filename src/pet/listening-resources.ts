export interface ListeningResource {
  id: string;
  title: string;
  pdfFile: string;
  sourcePdfUrl: string;
  audioUrl: string;
}

export const LISTENING_RESOURCES: ListeningResource[] = [
  {
    id: "schools-sample-1",
    title: "B1 Preliminary for Schools · Listening Sample Test 1",
    pdfFile: "697390-b1-preliminary-for-schools-listening-sample-test-1-tapescript.pdf",
    sourcePdfUrl: "https://www.cambridgeenglish.org/Images/697390-b1-preliminary-for-schools-listening-sample-test-1-tapescript.pdf",
    audioUrl: "https://www.cambridgeenglish.org/Images/709695-b1-preliminary-for-schools-handbook-for-teachers-listening-audio-files.mp3",
  },
  {
    id: "general-sample-1",
    title: "B1 Preliminary · Listening Sample Test 1",
    pdfFile: "697386-b1-preliminary-listening-sample-test-1-tapescript.pdf",
    sourcePdfUrl: "https://www.cambridgeenglish.org/Images/697386-b1-preliminary-listening-sample-test-1-tapescript.pdf",
    audioUrl: "https://www.cambridgeenglish.org/Images/505234-b1-preliminary-handbook-for-teachers-listening-audio-files.mp3",
  },
];

export function listeningPdfUrl(resource: ListeningResource): string {
  return `${import.meta.env.BASE_URL}listening/${resource.pdfFile}`;
}

export function resourceForFile(filename: string): ListeningResource | undefined {
  const originalName = filename.toLowerCase().replace(/\s*\(\d+\)(?=\.pdf$)/, "");
  return LISTENING_RESOURCES.find((resource) => originalName === resource.pdfFile.toLowerCase());
}

export function loadListeningResourceId(username: string): string {
  const saved = localStorage.getItem(`pet-listening-resource-v1-${username}`);
  return LISTENING_RESOURCES.find((resource) => resource.id === saved)?.id ?? LISTENING_RESOURCES[0].id;
}
