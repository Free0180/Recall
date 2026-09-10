import { PET_STUDY_WORDS } from "./pet-words";
import { validateArticle, type DailyArticle } from "./study-article";

export const OFFLINE_ARTICLE_VERSION = 2;

// Short scenes preserve target vocabulary in a chronological narrative.
const scenes: Array<Array<[string, string]>> = [
  [
    ["organise", "We helped organise a school fair."],
    ["decide", "We had to decide what to sell."],
    ["information", "We shared information about the fair online."],
    ["announce", "Our teacher agreed to announce the date."],
    ["recommend", "Friends helped us recommend activities to visitors."],
    ["probably", "The games would probably attract many children."],
    ["necessary", "Good planning was necessary for our team."],
    ["available", "Two large rooms were available for games."],
    ["borrow", "We could borrow tables from our school."],
    ["independent", "Planning everything helped us become more independent."],
  ],
  [
    ["journey", "Our journey there took just twenty minutes."],
    ["comfortable", "I wore comfortable shoes for the day."],
    ["adventure", "For me, it was a new adventure."],
    ["although", "Although it rained, many families came."],
    ["volunteer", "A volunteer helped us welcome the visitors."],
    ["responsible", "I was responsible for welcoming each family."],
    ["usually", "I usually feel shy around new people."],
    ["communicate", "However, I learnt to communicate more clearly."],
  ],
  [
    ["ability", "Mia used her ability to draw posters."],
    ["competition", "Next, we held a fun drawing competition."],
    ["improve", "Mia helped the children improve their pictures."],
    ["achieve", "Together, we could achieve more than alone."],
    ["favourite", "My favourite activity was making colourful cards."],
    ["traditional", "At lunchtime, families shared delicious traditional food."],
    ["environment", "We recycled paper to protect the environment."],
    ["behaviour", "Everyone thanked the children for their behaviour."],
    ["surprised", "I was surprised by everyone's lovely ideas."],
  ],
  [
    ["celebrate", "Finally, we took photos to celebrate together."],
    ["experience", "This experience taught me to help others."],
    ["opportunity", "It was a great opportunity to make friends."],
  ],
];

export function generateOfflineArticle(wordIds: number[], date: string, pool = PET_STUDY_WORDS): DailyArticle {
  const words = wordIds.map((id) => pool.find((word) => word.id === id));
  if (!words.length || words.some((word) => !word)) throw new Error("当天词表无效，暂时无法生成文章");
  const focusWords = words.map((word) => word!.word);
  if (words.some(word => word!.id >= 1000)) {
    // The expanded list has no curated story scenes. Use a truthful vocabulary-club
    // writing task instead of pretending unrelated dictionary examples form a story.
    const paragraphs = [
      `Last Saturday, I joined an English club at school. We wanted to practise writing together. Our teacher gave us these words: ${focusWords.join(", ")}. We read them aloud before starting our work.`,
      "First, we worked in pairs and wrote a short message. My partner checked my spelling while I checked her grammar. Some sentences were difficult, but our teacher helped us improve them. Then we shared our ideas with another group.",
      "I enjoyed the club because everyone was friendly. If you want to improve your English, you will enjoy it too. Next time, I hope to write a story with my friends.",
    ];
    return { ...validateArticle({ title: "Learning Together", paragraphs, grammar: [
      { label: "开头：时间与活动", example: "Last Saturday, I joined an English club at school.", explanation: "套用 Last Saturday, I …，交代时间、地点和活动；根据题目替换细节。" },
      { label: "感受与理由", example: "I enjoyed the club because everyone was friendly.", explanation: "用 I enjoyed … because … 表达感受并说明理由。First、Then 帮助正文衔接。" },
      { label: "第一条件句", example: "If you want to improve your English, you will enjoy it too.", explanation: "if 后用一般现在时，主句用 will + 动词原形；结尾向读者推荐活动。" },
    ] }, focusWords), source: "offline", offlineVersion: OFFLINE_ARTICLE_VERSION };
  }
  const targets = new Set(focusWords);
  const selected = scenes.map((scene) => scene.filter(([word]) => targets.has(word)).map(([, sentence]) => sentence).join(" "));
  const paragraphs = [
    `Last Saturday, I helped at a local fair. ${selected[0]}`.trim(),
    `First, we prepared the rooms. ${selected[1]} ${selected[2]}`.trim(),
    `${selected[3]} I enjoyed the day because we worked together. If you enjoy helping others, you will love it too.`.trim(),
  ];
  const extraDetails = [
    "Our aim was to raise money for new library books.",
    "During the afternoon, we played games with the younger children.",
    "When a little boy needed help, I showed him what to do.",
    "By the end of the day, everyone was smiling and laughing.",
    "I hope our class can take part again next year.",
    "It is a simple way to spend time with friends.",
  ];
  for (const detail of extraDetails) {
    if ((paragraphs.join(" ").match(/[a-z]+(?:['’-][a-z]+)*/gi)?.length ?? 0) >= 100) break;
    paragraphs[1] += ` ${detail}`;
  }
  const article = validateArticle({
    title: ["A Saturday to Remember", "Small Jobs, Big Smiles", "A Day at the Community Centre"][Math.abs(Date.parse(`${date}T00:00:00Z`) / 86_400_000 || 0) % 3],
    paragraphs,
    grammar: [
      { label: "开头：交代时间与活动", example: "Last Saturday, I helped at a local fair.", explanation: "套用：Last Saturday, I … at …。开头交代何时、做了什么、在哪里，注意回应题目要求。" },
      { label: "感受与理由", example: "I enjoyed the day because we worked together.", explanation: "套用：I enjoyed … because …。用 because 给出理由；正文用 First、Next、Finally 等连接词串起经历。" },
      { label: "第一条件句", example: "If you enjoy helping others, you will love it too.", explanation: "套用：If you enjoy …, you will love … too。if 后用一般现在时，主句用 will + 动词原形；结尾向读者提出建议。" },
    ],
  }, focusWords);
  return { ...article, source: "offline", offlineVersion: OFFLINE_ARTICLE_VERSION };
}
