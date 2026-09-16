export const WRITING_TASKS = [
  { id: "email-visit", title: "朋友来访", genre: "邮件", prompt: "Your English friend Alex is coming to visit you next Saturday. Write an email to Alex. Suggest a time and a place to meet, choose an indoor or outdoor activity and explain why, and tell Alex what to bring.", points: ["见面时间和地点", "活动及选择原因", "需要携带的物品"] },
  { id: "email-club", title: "邀请朋友参加社团", genre: "邮件", prompt: "Your English friend Sam wants to join an after-school club with you. Write an email to Sam. Suggest a club and explain why you like it, say when and where you can meet for the first session, and tell Sam what to bring.", points: ["推荐的社团及原因", "第一次集合的时间和地点", "需要携带的物品"] },
  { id: "email-rain", title: "改变周末计划", genre: "邮件", prompt: "You planned to play football with your English friend Jamie on Sunday, but heavy rain is expected. Write an email to Jamie. Explain why you need to change the plan, suggest a different activity and say why it would be enjoyable, and arrange a new time and place to meet.", points: ["改变计划的原因", "新活动及理由", "新的见面时间和地点"] },
  { id: "article-hobby", title: "我喜欢的课外活动", genre: "文章", prompt: "Your school English magazine wants articles about hobbies. Write an article about an activity you enjoy after school. Explain how you became interested in it, why you enjoy it, and how another student could get started. Give your article a title.", points: ["怎样开始这项爱好", "喜欢它的原因", "给初学者的建议"] },
  { id: "story-surprise", title: "一个意外的发现", genre: "故事", prompt: "Write a story that begins with this sentence: When I opened my school bag, I found something that was not mine. Continue the story and give it a clear ending.", points: ["使用指定开头", "事件经过清楚", "有与前文呼应的结尾"] },
] as const;
export type WritingTask = typeof WRITING_TASKS[number];
export interface WritingPhoto { name: string; data: string }
export interface WritingAttempt {
  id: string; taskId: string; createdAt: string; submittedAt: string | null;
  plan: string; original: string; minutes: string; independent: boolean; help: string;
  photos: WritingPhoto[]; feedback: string; revision: string; revisionFeedback: string;
}
export function createAttempt(taskId: string): WritingAttempt {
  return { id: crypto.randomUUID(), taskId, createdAt: new Date().toISOString(), submittedAt: null, plan: "", original: "", minutes: "", independent: true, help: "", photos: [], feedback: "", revision: "", revisionFeedback: "" };
}
export function wordCount(text: string): number { return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0; }
export function taskFor(attempt: WritingAttempt): WritingTask {
  const task = WRITING_TASKS.find(task => task.id === attempt.taskId);
  if (!task) throw new Error("找不到对应的写作题目。");
  return task;
}
export function reviewMaterials(attempt: WritingAttempt): string {
  const task = taskFor(attempt);
  return `# PET 原创写作练习：${task.title}\n\n题型：${task.genre}；建议约 100 词。非官方试题。\n\n## 完整题目\n${task.prompt}\n\n## 完成情况\n用时：${attempt.minutes || "未填写"} 分钟\n独立完成：${attempt.independent ? "是" : "否"}\n帮助或补充说明：${attempt.help || "无"}\n\n## 孩子的审题记录\n${attempt.plan || "未填写"}\n\n## 原稿\n${attempt.original || "作文见另行附上的照片；请勿根据题目猜测内容。"}\n\n照片：${attempt.photos.map(photo => photo.name).join("、") || "无"}（图片不包含在此文本内，请另行附上。）\n\n## 已有点评\n${attempt.feedback || "暂无"}\n\n## 修改稿\n${attempt.revision || "暂无"}\n\n## 请按以下方式点评\n请区分优点、任务完成度、语言问题、三个优先修改任务；看不清的手写内容请明确标出，不要猜测。请勿据此预测正式考试成绩。若已有修改稿，请比较改进和仍需练习的问题。\n\n除正常点评外，请提供一个 JSON 文件或 JSON 代码块，供我保存为 .json 并导入应用。保留以下标识，仅填写 feedback 和 revisionFeedback（没有修改稿则后者留空）：\n\n${JSON.stringify({ kind: "pet-writing-feedback", version: 1, attemptId: attempt.id, taskId: attempt.taskId, feedback: "请在这里填写原稿点评", revisionFeedback: "" }, null, 2)}\n`;
}
function text(value: unknown, max: number): value is string { return typeof value === "string" && value.length <= max; }
export function validAttempt(value: unknown): value is WritingAttempt {
  if (!value || typeof value !== "object") return false;
  const a = value as WritingAttempt;
  return text(a.id, 100) && !!a.id && WRITING_TASKS.some(task => task.id === a.taskId)
    && text(a.createdAt, 50) && Number.isFinite(Date.parse(a.createdAt))
    && (a.submittedAt === null || (text(a.submittedAt, 50) && Number.isFinite(Date.parse(a.submittedAt))))
    && text(a.plan, 2000) && text(a.original, 12000) && text(a.minutes, 4) && /^\d{0,4}$/.test(a.minutes)
    && typeof a.independent === "boolean" && text(a.help, 2000) && text(a.feedback, 12000)
    && text(a.revision, 12000) && text(a.revisionFeedback, 12000)
    && Array.isArray(a.photos) && a.photos.length <= 2 && a.photos.every(p => p && text(p.name, 200)
      && text(p.data, 2_800_000) && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(p.data));
}
export function importFeedback(raw: string, attempt: WritingAttempt): Pick<WritingAttempt, "feedback" | "revisionFeedback"> {
  if (raw.length > 30_000) throw new Error("点评文件过大。");
  const data = JSON.parse(raw);
  if (data?.kind !== "pet-writing-feedback" || data.version !== 1 || data.attemptId !== attempt.id || data.taskId !== attempt.taskId) throw new Error("这份点评不属于当前作文，请选择导出材料时对应的写作记录。");
  if (!text(data.feedback, 12000) || !text(data.revisionFeedback, 12000)) throw new Error("点评格式不正确，两个点评字段必须是文字。");
  return { feedback: data.feedback, revisionFeedback: data.revisionFeedback };
}
export function writingBackup(username: string, attempts: WritingAttempt[]): string {
  return JSON.stringify({ kind: "pet-writing-backup", version: 1, username, attempts });
}
export function readWritingBackup(raw: string, username: string): WritingAttempt[] {
  const data = JSON.parse(raw);
  if (data?.kind !== "pet-writing-backup" || data.version !== 1 || data.username !== username) throw new Error("请选择当前账号的写作备份，不能导入其他账号的数据。");
  if (!Array.isArray(data.attempts) || data.attempts.length > 12 || !data.attempts.every(validAttempt)
    || new Set(data.attempts.map((a: WritingAttempt) => a.id)).size !== data.attempts.length) throw new Error("备份内容不完整或格式不正确。");
  return data.attempts;
}
