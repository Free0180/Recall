import { validLessons, type LessonWork } from "./course-data";
export type Skill = "grammar" | "reading" | "listening";
export interface Question { id: string; prompt: string; choices?: string[]; answer: string; evidence: string; explanation: string }
export interface Exercise { id: string; skill: Skill; title: string; minutes: number; instruction: string; text: string; questions: Question[]; apply?: string }
const q = (id: string, prompt: string, answer: string, choices: string[] | undefined, evidence: string, explanation: string): Question => ({ id, prompt, answer, choices, evidence, explanation });
export const EXERCISES: Exercise[] = [
  { id: "g-foundation", skill: "grammar", title: "句子基础 · 从这次作文开始", minutes: 6, instruction: "先看简短讲解，再完成练习，最后把句型用于自己的邮件。", text: "描述状态需要 be：It is near my house.\n动词作主语常用 -ing：Watching films is fun.\nyou 是你；your 表示你的。there 前一般不加 at。\n约见时把时间、地点、活动写清楚。", questions: [
    q("g1", "The cinema ___ not far from my house.", "is", ["is", "are", "does"], "The cinema 是单数；far 描述状态。", "这里没有其他谓语动词，需要 is，不用 does。"),
    q("g2", "___ films with friends is fun.", "Watching", ["Watch", "Watching", "Watched"], "整个 Watching films with friends 作主语。", "动名词短语可作主语。"),
    q("g3", "Please bring ___ water bottle.", "your", ["you", "your", "yours"], "后面有名词 water bottle。", "名词前用 your；yours 独立使用。"),
    q("g4", "We can meet ___ the library ___ 10 am.", "at / at", ["at / at", "in / on", "on / in"], "具体会面点和钟点都可用 at。", "at the library; at 10 am。"),
  ], apply: "写两句约见朋友的话，包含具体时间、地点和喜欢该活动的原因。检查 be、your 和 -ing。" },
  { id: "g-time", skill: "grammar", title: "时态与情态动词", minutes: 6, instruction: "读时间线，再选符合语境的形式。", text: "every Saturday → 一般现在时；yesterday → 一般过去时；right now → 现在进行时。\nhave/has + 过去分词可连接过去经历与现在。mustn't 表示禁止；don't have to 表示不必。", questions: [
    q("g5", "Yesterday we ___ a science museum.", "visited", ["visit", "visited", "have visited"], "Yesterday 是已结束的过去时间。", "用一般过去时。"),
    q("g6", "Look! My brother ___ for the bus.", "is running", ["runs", "is running", "ran"], "Look! 提示此刻发生。", "现在进行时为 be + -ing。"),
    q("g7", "I ___ this book twice, so I know the ending.", "have read", ["have read", "am reading", "read tomorrow"], "twice 表经历次数，so 引出当前结果。", "此处用现在完成时表达读过两次。"),
    q("g8", "The sign says 'No swimming'. You ___ swim here.", "mustn't", ["mustn't", "don't have to", "should"], "No swimming 表示禁止。", "don't have to 是不必，不是禁止。"),
  ], apply: "用三句话介绍上周末、现在和下周末的活动。" },
  { id: "g-compare", skill: "grammar", title: "比较级、数量与搭配", minutes: 5, instruction: "先分清可数与不可数，再选表达。", text: "比较两者常用比较级 + than。many/fewer 修饰可数复数；much/less 修饰不可数名词。be interested in 是固定搭配。", questions: [
    q("g9", "This bag is ___ than mine.", "lighter", ["lighter", "lightest", "light"], "than 提示两者比较。", "light 的比较级是 lighter。"),
    q("g10", "We haven't got ___ time before the bus leaves.", "much", ["many", "much", "a few"], "time 在此是不可数名词。", "否定句中常用 much time。"),
    q("g11", "There are ___ people here than yesterday.", "fewer", ["fewer", "less", "little"], "people 是可数复数。", "比较数量更少用 fewer。"),
    q("g12", "I'm interested ___ learning about animals.", "in", ["in", "on", "at"], "be interested in", "把完整搭配一起记忆。"),
  ], apply: "比较两项周末活动的价格、距离或趣味，并选择一项。" },
  { id: "g-links", skill: "grammar", title: "条件句、被动与定语从句", minutes: 6, instruction: "连接两个想法，让表达更清楚。", text: "真实未来条件：If + 一般现在时，主句可用 will。\n被动语态：be + 过去分词。\nwho 指人；which 常指事物。because 给原因，although 表让步。", questions: [
    q("g13", "If it ___ tomorrow, we'll visit the library.", "rains", ["rains", "will rain", "rained"], "If 从句谈论真实未来条件。", "此处从句不用 will rain。"),
    q("g14", "The sports centre ___ in 2020.", "was built", ["was built", "built", "is building"], "中心是被建造的，且时间为过去。", "过去被动：was/were + built。"),
    q("g15", "My friend, ___ lives nearby, plays tennis.", "who", ["who", "which", "where"], "先行词 My friend 指人。", "who 引出对朋友的补充说明。"),
    q("g16", "___ it was cold, we enjoyed our walk.", "Although", ["Although", "Because", "So"], "冷与享受散步形成转折。", "Although 引出让步，不要再接 but。"),
  ], apply: "邀请朋友出行：用 if 写雨天预案，再用 because 解释选择。" },
  { id: "r1", skill: "reading", title: "Reading 1 · 短通知", minutes: 3, instruction: "原创缩短练习：理解通知的目的和限制。", text: "SCHOOL LIBRARY\nThis Friday the library will close at 3 pm instead of 5 pm. Return books using the box outside after 3 pm. The box is for returns only.", questions: [q("r1q", "What can students do at 4 pm on Friday?", "Leave borrowed books in the box.", ["Borrow books from the librarian.", "Leave borrowed books in the box.", "Collect new books from the box."], "Return books using the box outside after 3 pm.", "return = 归还；for returns only 排除借书和取新书。instead of 表示时间变更。") ] },
  { id: "r2", skill: "reading", title: "Reading 2 · 人物与活动匹配", minutes: 5, instruction: "原创缩短练习：2 位人物、4 个选项；每人匹配一个同时满足条件的活动。", text: "A. Art Lab: Saturday morning. Use recycled materials to build models. All materials provided.\nB. Stage Club: Friday evening. Practise acting with a group. No experience needed.\nC. Photo Walk: Saturday afternoon. Explore the park and take photographs. Bring your own camera.\nD. Nature Talk: Saturday morning. Listen to an expert explain local birds. Indoors; no equipment needed.", questions: [
    q("r2a", "Maya is free on Saturday morning. She wants to make something and has no equipment.", "A", ["A", "B", "C", "D"], "Saturday morning; build models; All materials provided.", "D 虽也无需器材，但只是听讲，不满足 make something。"),
    q("r2b", "Leo wants an outdoor activity after lunch on Saturday. He owns a camera.", "C", ["A", "B", "C", "D"], "Saturday afternoon; Explore the park; own camera.", "先圈时间、地点、器材三个限制，不能只匹配兴趣词。"),
  ] },
  { id: "r3", skill: "reading", title: "Reading 3 · 长文理解入门", minutes: 6, instruction: "原创短文，训练主旨、态度与细节；篇幅短于正式试卷。", text: "When our teacher suggested a school garden, I wasn't excited. I thought gardening was something only adults enjoyed. My friend Sam persuaded me to try it for one afternoon.\nAt first, we planted seeds too close together. A neighbour showed us how much space each plant needed. I was surprised that such a small change helped them grow.\nNow I spend every Tuesday in the garden. We sell some vegetables to buy new tools, but earning money isn't the best part for me. I enjoy working with people I didn't know before. Next term, we hope to invite younger pupils. I want them to discover that getting something wrong can be the beginning of learning.", questions: [
    q("r3a", "Why did the writer first join the project?", "A friend encouraged them.", ["They wanted to sell vegetables.", "A friend encouraged them.", "They already loved gardening."], "My friend Sam persuaded me to try it.", "persuaded 与 encouraged 是此处的同义表达；想赚钱是干扰信息。"),
    q("r3b", "What does the writer enjoy most now?", "Making connections with other people.", ["Buying expensive tools.", "Never making mistakes.", "Making connections with other people."], "I enjoy working with people I didn't know before.", "but 后说明真实重点。"),
    q("r3c", "Which title fits best?", "A project that changed my mind", ["How to earn money quickly", "A project that changed my mind", "Why children dislike gardens"], "wasn't excited → Now I spend every Tuesday", "主旨需覆盖态度变化，不能只选文中出现的细节。"),
  ] },
  { id: "r4", skill: "reading", title: "Reading 4 · 补全文章", minutes: 5, instruction: "原创缩短练习：2 个空、3 个选项；注意指代和事件顺序。", text: "Our class planned a cycle trip. On Friday, I checked my bike and found a flat tyre. [1]\nThe next morning, it worked perfectly. We followed a path beside the river. Halfway along, dark clouds appeared. [2] We reached a café just before the rain began.\nA. Luckily, my uncle helped me repair it that evening.\nB. So our teacher suggested finding somewhere indoors.\nC. We decided to buy tickets for the train next month.", questions: [
    q("r4a", "Gap 1", "A", ["A", "B", "C"], "flat tyre → repair it → it worked perfectly", "it 指自行车或车胎；that evening 接 Friday。"),
    q("r4b", "Gap 2", "B", ["A", "B", "C"], "dark clouds → indoors → café", "因果和时间连续；C 的 next month 与当日出行不符。"),
  ] },
  { id: "r5", skill: "reading", title: "Reading 5 · 选择完形", minutes: 4, instruction: "原创缩短练习：根据搭配和上下文选词。", text: "Last month I [1] a photography club. At first it was difficult to [2] good photographs indoors. Our teacher told us to pay [3] to the light rather than buy a more expensive camera.", questions: [
    q("r5a", "Gap 1", "joined", ["joined", "arrived", "entered into"], "joined a club", "参加社团用 join；arrive 后不能直接接 a club。"),
    q("r5b", "Gap 2", "take", ["do", "take", "make"], "take photographs", "英语固定搭配，不能逐字翻译中文。"),
    q("r5c", "Gap 3", "attention", ["attention", "careful", "notice"], "pay attention to", "pay attention to 是完整搭配。"),
  ] },
  { id: "r6", skill: "reading", title: "Reading 6 · 开放完形", minutes: 4, instruction: "每空只填一个英语单词。", text: "Dear Jo,\nThanks [1] inviting me to your party. I would love to come. Could you tell me [2] time it starts? My brother is older [3] me and can drive me there.\nSee you soon!", questions: [
    q("r6a", "Gap 1", "for", undefined, "Thanks for + -ing", "表示因某事感谢某人。"),
    q("r6b", "Gap 2", "what", undefined, "what time it starts", "间接疑问句用陈述语序。"),
    q("r6c", "Gap 3", "than", undefined, "older than", "比较级后接 than。"),
  ] },
  { id: "l1", skill: "listening", title: "Listening 1 · 识别具体信息", minutes: 3, instruction: "原创文字选项预备练习，正式题使用图片选项。听清最终决定。", text: "I usually cycle to school, but my bike needs repairing. Dad offered to drive me today, but he has an early meeting. So I'll take the bus. The stop is just outside our house.", questions: [q("l1q", "How will the speaker get to school today?", "By bus", ["By bike", "By car", "By bus"], "So I'll take the bus.", "usually 是平时；offered 是提议，不是最终安排。") ] },
  { id: "l2", skill: "listening", title: "Listening 2 · 短对话与态度", minutes: 3, instruction: "原创单人合成朗读，不能替代真人对话测评。注意意见的转折。", text: "Boy: Did you enjoy the new adventure film? Girl: The beginning was slow, and the music was a bit loud. But once they reached the island, I couldn't stop watching. Boy: Was the ending good? Girl: I guessed it early, but that didn't spoil it. I'd recommend the film to anyone who likes exciting stories.", questions: [q("l2q", "What is the girl's overall opinion?", "She thinks it is worth watching.", ["She thinks it is worth watching.", "She dislikes it because of the ending.", "She only enjoyed the music."], "I'd recommend the film", "局部批评不等于整体不喜欢；recommend 表明总体态度。") ] },
  { id: "l3", skill: "listening", title: "Listening 3 · 填写信息", minutes: 4, instruction: "原创简短独白；数字可用阿拉伯数字。姓名拼写不区分大小写。", text: "Here is some information about our museum trip. It's on the fourteenth of June, not the thirteenth as we first planned. Meet at school at a quarter past nine. The coach leaves fifteen minutes later. The ticket costs eight pounds, and lunch is not included. If you have questions, ask Miss Green. Her surname is spelled G, R, E, E, N.", questions: [
    q("l3a", "Date: ___ June（填数字）", "14", undefined, "the fourteenth ... not the thirteenth", "纠正后的日期是 14；13 为旧计划。"),
    q("l3b", "Meeting time: ___（格式 9:15）", "9:15", undefined, "Meet ... at a quarter past nine.", "9:30 是发车时间，不是集合时间。"),
    q("l3c", "Teacher's surname: Miss ___", "Green", undefined, "G, R, E, E, N", "字母拼写辅助确认姓名。"),
  ] },
  { id: "l4", skill: "listening", title: "Listening 4 · 访谈理解入门", minutes: 5, instruction: "原创缩短访谈，练习原因与态度；正式题的长度和说话人更多样。", text: "Interviewer: Nina, why did you start a book club? Nina: I used to read the same kind of adventure story. I wanted friends to suggest something different. Interviewer: Was organising the club difficult? Nina: Finding a room was easy. The library offered us one. Choosing a time when everyone was free was much harder. Interviewer: What would you change? Nina: We spend too long deciding on the next book. Next month, each member will suggest one and we'll vote. I don't want to choose all the books myself.", questions: [
    q("l4a", "Why did Nina start the club?", "To discover different books.", ["To get a job in a library.", "To discover different books.", "To write adventure stories."], "suggest something different", "same kind 与 different 构成起因。"),
    q("l4b", "What was hardest to organise?", "A suitable meeting time.", ["A suitable meeting time.", "A room in the library.", "Enough books to sell."], "Choosing a time ... much harder", "easy 与 harder 对比，排除 room。"),
    q("l4c", "How will the club choose books next month?", "Members will vote.", ["Nina will choose alone.", "The librarian will choose.", "Members will vote."], "each member will suggest one and we'll vote", "will 提示未来安排。"),
  ] },
];

export const PHRASES = [
  ["School", "take part in", "参加", "I took part in a school show.", "take / took / taken；join a club 与 take part in an activity"],
  ["School", "pay attention to", "注意", "Pay attention to the instructions.", "attention (n.)；attentive (adj.)；to 后可接名词或 -ing"],
  ["Travel", "get on", "上车", "We got on the bus at nine.", "get off 下车；get into a car 上小汽车"],
  ["Travel", "on time", "准时", "The train arrived on time.", "in time 及时，来得及；arrive / arrival"],
  ["Leisure", "be interested in", "对……感兴趣", "I am interested in making models.", "interested 描述人的感受；interesting 描述事物"],
  ["Leisure", "look forward to", "期待", "I look forward to seeing you.", "to 后接名词或 -ing；不能直接接 see"],
  ["Health", "keep fit", "保持健康", "Cycling helps me keep fit.", "stay healthy 近义表达；fit / fitter"],
  ["Health", "have a rest", "休息", "Let's have a rest after our walk.", "take a break 近义表达；rest 可作名词或动词"],
  ["Environment", "pick up", "捡起", "We picked up litter in the park.", "litter 不可数；pick it up，代词放中间"],
  ["Environment", "instead of", "代替，而不是", "We walked instead of taking a taxi.", "后接名词或 -ing；instead 可单独作副词"],
  ["People", "get on well with", "与……相处融洽", "I get on well with my classmates.", "get / got；classmate / teammate / roommate"],
  ["People", "look after", "照顾", "I look after my little brother.", "take care of 近义；look for 寻找，不要混淆"],
] as const;
export const DIMENSIONS = ["看得懂", "听得出", "拼得对", "会使用"] as const;
export const SPEAKING_TASKS = [
  { title: "Part 1 · 个人问答", minutes: 2, prompt: "What do you enjoy doing after school? Tell me about a place you like visiting. What did you do last weekend?", guide: "家长逐题提问。孩子每题回答并补一个原因或例子，不提前背全文。" },
  { title: "Part 2 · 照片描述", minutes: 1, prompt: "Describe a photograph of people doing an activity together. Say where they are, what they are doing and what you can see around them.", guide: "选一张自己拍摄或有权使用的生活照片。观察后连续描述约 1 分钟；本练习不预置考试图片。不会的词可换简单说法。" },
  { title: "Part 3 · 合作讨论", minutes: 3, prompt: "A class wants to celebrate the end of term. Discuss these ideas: a picnic, a sports afternoon, a film, a cooking activity and a museum visit. Decide which would be best.", guide: "家长或同伴参与。轮流建议、给理由、回应和邀请对方发言，最后共同决定。这里用文字选项训练，正式题有视觉提示。" },
  { title: "Part 4 · 延伸讨论", minutes: 3, prompt: "Is it better to spend free time indoors or outdoors? Why? How can friends choose an activity everyone enjoys? Is trying a new activity important?", guide: "追问 Why? 或 Can you give an example? 检查能否扩展回答，不以语速快慢单独判断水平。" },
] as const;

export interface Result { id: string; exerciseId: string; at: string; seconds: number; mode: "practice" | "check"; answers: Record<string, string>; correct: number; total: number; causes: Record<string, string> }
export interface ManualRecord { id: string; kind: "speaking" | "mock" | "mistake"; at: string; title: string; text: string; feedback: string; resolved: boolean }
export interface PrepState { examMonth: string; examDate: string; weekdayMinutes: number; weekendMinutes: number; ket: string; priority: string; resources: string; completed: Record<string, boolean>; results: Result[]; phraseChecks: Record<string, boolean>; records: ManualRecord[]; lessons?: Record<string, LessonWork> }
export function freshPrep(): PrepState { return { examMonth: "2027-03", examDate: "", weekdayMinutes: 60, weekendMinutes: 120, ket: "成绩待公布", priority: "先观察各科；写作重点检查 be、your、-ing 和时间地点。", resources: "尚未购买备考材料", completed: {}, results: [], phraseChecks: {}, records: [] }; }
export function correctAnswer(answer: string, expected: string): boolean { return answer.trim().toLowerCase().replace(/’/g, "'") === expected.trim().toLowerCase(); }
export function markExercise(exercise: Exercise, answers: Record<string, string>): number { return exercise.questions.filter(item => correctAnswer(answers[item.id] ?? "", item.answer)).length; }
export function dateKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function weekDays(now = new Date()): Date[] { const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); start.setDate(start.getDate() - (start.getDay() + 6) % 7); return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)); }
export function firstResults(results: Result[]): Result[] { const seen = new Set<string>(); return results.filter(item => { if (seen.has(item.exerciseId)) return false; seen.add(item.exerciseId); return true; }); }
export function unresolvedQuestions(results: Result[]): Array<{ exercise: Exercise; question: Question; result: Result }> {
  const latest = new Map<string, Result>(); results.forEach(item => latest.set(item.exerciseId, item));
  return EXERCISES.flatMap(exercise => { const result = latest.get(exercise.id); return result ? exercise.questions.filter(item => !correctAnswer(result.answers[item.id] ?? "", item.answer)).map(question => ({ exercise, question, result })) : []; });
}
function stringMap(value: unknown, type: "string" | "boolean"): boolean { return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length <= 5000 && Object.values(value).every(item => typeof item === type && (type !== "string" || (item as string).length <= 2000)); }
export function validPrep(value: unknown): value is PrepState {
  if (!value || typeof value !== "object") return false;
  const s = value as PrepState;
  return typeof s.examMonth === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(s.examMonth) && typeof s.examDate === "string" && (s.examDate === "" || /^20\d{2}-\d{2}-\d{2}$/.test(s.examDate)) && [s.weekdayMinutes, s.weekendMinutes].every(n => Number.isInteger(n) && n >= 15 && n <= 240)
    && [s.ket, s.priority, s.resources].every(v => typeof v === "string" && v.length <= 5000) && stringMap(s.completed, "boolean") && stringMap(s.phraseChecks, "boolean")
    && Array.isArray(s.results) && s.results.length <= 500 && s.results.every(r => {
      if (!r || typeof r.id !== "string" || typeof r.at !== "string" || !Number.isFinite(Date.parse(r.at)) || !Number.isFinite(r.seconds) || r.seconds < 0 || !["practice", "check"].includes(r.mode) || !stringMap(r.answers, "string") || !stringMap(r.causes, "string")) return false;
      const exercise = EXERCISES.find(e => e.id === r.exerciseId); return !!exercise && r.total === exercise.questions.length && r.correct === markExercise(exercise, r.answers);
    }) && Array.isArray(s.records) && s.records.length <= 300 && s.records.every(r => r && typeof r.id === "string" && typeof r.at === "string" && Number.isFinite(Date.parse(r.at)) && ["speaking", "mock", "mistake"].includes(r.kind) && [r.title, r.text, r.feedback].every(t => typeof t === "string" && t.length <= 10000) && typeof r.resolved === "boolean")
    && new Set(s.results.map(r => r.id)).size === s.results.length && new Set(s.records.map(r => r.id)).size === s.records.length && validLessons(s.lessons);
}
export function readPrepBackup(text: string, username: string): PrepState { if (text.length > 4_000_000) throw new Error("备份超过大小限制。"); const value = JSON.parse(text); if (value.kind !== "pet-preparation" || value.version !== 1 || value.username !== username || !validPrep(value.data)) throw new Error("备份格式不正确，或不属于当前账号。"); return value.data; }
export function reportText(username: string, state: PrepState): string {
  const first = firstResults(state.results); const recent = state.results.filter(r => Date.now() - Date.parse(r.at) < 7 * 86400000);
  return [`PET 备考复盘 · ${username} · ${dateKey()}`, `目标月份：${state.examMonth}；具体日期：${state.examDate || "待定"}`, `KET：${state.ket}`, `重点：${state.priority}`, `近 7 天提交 ${recent.length} 次（含重做）；累计首次作答 ${first.reduce((n,r) => n+r.correct,0)}/${first.reduce((n,r) => n+r.total,0)} 题`, "小样本原创练习，不换算剑桥分数或预测通过率。", `待复习客观题 ${unresolvedQuestions(state.results).length} 道`, ...state.records.map(r => `\n${r.kind} · ${r.title}\n${r.text}\n点评：${r.feedback || "待手工点评"}\n${r.resolved ? "已复查" : "待复查"}`), "写作原稿、照片和点评请在写作模块单独导出；录音文件需另外附上。"].join("\n");
}
