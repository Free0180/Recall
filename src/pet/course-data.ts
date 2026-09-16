export interface CourseQuestion { prompt: string; choices: string[]; answer: string; why: string }
export interface Lesson {
  id: string; kind: "grammar" | "writing"; title: string; goal: string;
  teaching: string[]; examples: Array<[string, string]>; mistake: [string, string, string];
  questions: CourseQuestion[]; sentence: string; paragraph: string; model: string; checklist: string[];
}
const question = (prompt: string, choices: string[], answer: string, why: string): CourseQuestion => ({ prompt, choices, answer, why });
export const LESSONS: Lesson[] = [
  {
    id: "c-be", kind: "grammar", title: "01 · 先把句子写完整", goal: "分清 be 动词与动作动词，修正这次作文中的漏词。",
    teaching: ["说主语‘是什么、在哪里、怎么样’，常用主语 + be + 补充信息。I 用 am；单数用 is；you 和复数用 are。", "说主语做什么，用动作动词：We watch films. 一般现在时中不要多加 be，不能写 We are watch films。", "your 后接名词，表示‘你的’；you 是‘你’。检查句子时先找主语，再找谓语，最后检查名词前的代词。"],
    examples: [["The cinema is near my house.", "电影院在哪里：is 不能漏。"], ["You can bring your water bottle.", "you 是带东西的人，your 说明水瓶属于谁。"]],
    mistake: ["It not far from my house.", "It is not far from my house.", "far 是形容词，句子需要 is 表达状态。"],
    questions: [question("My friends ___ at the park.", ["is", "are", "do"], "are", "friends 是复数，at the park 表示位置。"), question("Please bring ___ notebook.", ["you", "your", "yours"], "your", "名词 notebook 前用 your；yours 不能这样接名词。")],
    sentence: "改正并解释：The library near my house. Please bring you pen.", paragraph: "用 3 句介绍你家附近的地方：在哪里、能做什么、朋友要带什么。", model: "The park is near my house. We can play football there. Please bring your water bottle.", checklist: ["每句有完整谓语", "单复数与 be 一致", "you / your 使用正确"]
  },
  {
    id: "c-ing", kind: "grammar", title: "02 · -ing 与 to do 怎么选", goal: "把喜欢、期待和计划写准确。",
    teaching: ["把一项活动当作主语时，可以用 -ing：Swimming is fun. 整项活动作主语，常搭配单数 is。", "enjoy 后接 -ing；want、decide 后接 to do。它们是不同搭配，不能凭中文逐字翻译。", "介词后动词用 -ing。look forward to 中的 to 是介词，所以写 look forward to seeing you。先记完整搭配，再替换活动。"],
    examples: [["Watching films helps me relax.", "Watching films 是主语。"], ["We decided to visit the museum.", "决定做某事：decide to do。"]],
    mistake: ["I enjoy to play football.", "I enjoy playing football.", "enjoy 后接 -ing。"],
    questions: [question("I'm looking forward to ___ you.", ["see", "seeing", "saw"], "seeing", "这里 to 是介词。"), question("We want ___ a new club.", ["join", "joining", "to join"], "to join", "want to do 表示想做某事。")],
    sentence: "用 enjoy、want 和 look forward to 分别写一句，不要只抄例句。", paragraph: "写 3—4 句介绍爱好、想尝试的活动和期待与朋友做的事情。", model: "I enjoy making models. I want to join the art club next term. I'm looking forward to meeting other young artists.", checklist: ["enjoy 后用 -ing", "want 后用 to do", "介词后的动词形式正确"]
  },
  {
    id: "c-tense", kind: "grammar", title: "03 · 过去事件与个人经历", goal: "分清一般过去时、现在完成时和故事背景。",
    teaching: ["具体、已结束的过去时间，用一般过去时：I visited it last Sunday. yesterday、last week 常提示这一点。", "谈截至现在的经历或持续状态，可用 have/has + 过去分词：I have visited it twice. 不把 yesterday 硬接在这种现在完成时句子后。", "过去进行时 was/were + -ing 表示当时正在发生的背景；一般过去时可以引出打断背景的事件。写故事时先确定时间线。"],
    examples: [["I have lived here for three years.", "从过去持续到现在；for 接时长，since 接起点。"], ["I was reading when the phone rang.", "正在读书是背景，电话响是事件。"]],
    mistake: ["I have visited the zoo yesterday.", "I visited the zoo yesterday.", "yesterday 指明已结束的过去时间。"],
    questions: [question("I ___ this film twice, so I know the ending.", ["have seen", "am seeing", "see tomorrow"], "have seen", "谈截至现在的经历。"), question("We were walking home when it ___ to rain.", ["starts", "started", "has started"], "started", "过去时事件与过去进行时背景配合。")],
    sentence: "写‘去年我参观过这个博物馆’和‘我已经参观过它三次’，说明为什么时态不同。", paragraph: "写一个 3—4 句的小故事：当时在做什么、突然发生什么、后来怎样。", model: "I was waiting for the bus when I heard someone call my name. It was my old friend Leo. We talked until the bus arrived.", checklist: ["具体过去时间搭配过去时", "have/has 后是过去分词", "故事时间线一致"]
  },
  {
    id: "c-used", kind: "grammar", title: "04 · 过去习惯与改变的计划", goal: "表达以前怎样、现在怎样，以及原计划。",
    teaching: ["used to + 动词原形表示过去的习惯或状态，通常暗示现在不同。不要把它用于一次性的昨天事件。", "否定常写 didn't use to，didn't 后用 use。be used to + 名词/-ing 表示习惯于，是另一个结构，本课先不混用。", "was/were going to + 动词原形表示过去打算做的事情；可以用 but 说明计划改变，但这个结构本身不总表示计划失败。"],
    examples: [["I used to stay indoors, but now I cycle every weekend.", "用过去与现在对比表现变化。"], ["We were going to have a picnic, but it started raining.", "先交代计划，再说明改变原因。"]],
    mistake: ["I didn't used to like sports.", "I didn't use to like sports.", "didn't 后接动词原形。"],
    questions: [question("I used to ___ to school.", ["walk", "walking", "walked"], "walk", "used to 后接原形。"), question("We ___ going to swim, but the pool was closed.", ["are", "were", "have"], "were", "描述过去的计划，we 搭配 were。")],
    sentence: "写一句你过去和现在的不同，再写一句因天气改变的计划。", paragraph: "用 3—4 句向朋友解释周末计划的改变，并给出新安排。", model: "We were going to play tennis, but the sports centre is closed. We could visit the museum instead. It has an interesting exhibition about robots.", checklist: ["used to 后接原形", "过去习惯有合理语境", "计划改变后给出替代安排"]
  },
  {
    id: "c-if", kind: "grammar", title: "05 · 条件句：安排与假设", goal: "用不同条件句表达规律、可能性和想象。",
    teaching: ["规律或常见结果：If + 一般现在时，主句也可用一般现在时。If I sleep badly, I feel tired.", "真实未来可能：If + 一般现在时，主句可用 will/can + 原形。此类 if 从句通常不写 will。", "假设或不太可能的情况：If + 过去式，主句用 would + 原形。If I had more time, I would learn the guitar. If I were you 可用于建议。"],
    examples: [["If it rains, we can watch a film at home.", "给出真实可行的雨天预案。"], ["If I were you, I would take a jacket.", "假设自己处于对方的位置，提出建议。"]],
    mistake: ["If it will rain, we will stay inside.", "If it rains, we will stay inside.", "真实未来条件中，if 从句用现在时。"],
    questions: [question("If she ___ early, we'll start at ten.", ["arrives", "will arrive", "arrived"], "arrives", "真实未来条件。"), question("If I had a garden, I ___ grow vegetables.", ["will", "would", "am"], "would", "had 与 would 构成假设。")],
    sentence: "为一次户外活动写雨天预案；再写‘如果我有更多时间，我会……’。", paragraph: "邀请朋友参加活动，写正常安排和备用方案，各给一个理由。", model: "We could play football in the park on Saturday. If it rains, we can go to the sports centre instead. It has an indoor court, so we can still have fun.", checklist: ["分清真实安排与假设", "if 从句时态恰当", "备用方案与条件有逻辑联系"]
  },
  {
    id: "c-report", kind: "grammar", title: "06 · 礼貌问句与转述", goal: "把直接问题改成自然的邮件表达。",
    teaching: ["直接问句：What time does it start? 间接问句：Could you tell me what time it starts? 后半句采用主语在前的陈述语序。", "一般疑问句嵌入时可用 if/whether：Do you know if the café is open? 不写 if is the café open。", "转述过去的话常需调整人称和时态：Tom said, 'I am tired.' → Tom said that he was tired. tell 后通常需要听话人，如 told me；是否回移时态还要看内容是否仍成立，本课先练过去语境。"],
    examples: [["Could you tell me where we should meet?", "where 后是 we should meet。"], ["Mia told me that she was busy that day.", "用 told me 说明她告诉了谁。"]],
    mistake: ["Could you tell me where is the station?", "Could you tell me where the station is?", "嵌入问句使用陈述语序。"],
    questions: [question("Do you know what time ___?", ["does it close", "it closes", "closes it"], "it closes", "主语 it 在谓语 closes 前。"), question("Yesterday Sam ___ me that he was ill.", ["said", "told", "spoke"], "told", "tell someone；say to someone。")],
    sentence: "把 Where do we meet? 和 Is lunch included? 分别改为礼貌询问。", paragraph: "写一小段邮件，询问活动开始时间、集合地点和是否需要带午餐。", model: "Could you tell me what time the trip starts? I'd also like to know where we should meet and whether lunch is included.", checklist: ["间接问句不用疑问倒装", "say / tell 搭配正确", "问题与任务有关"]
  },
  {
    id: "c-relative", kind: "grammar", title: "07 · 用从句补充细节", goal: "把两个相关句子连起来，避免重复。",
    teaching: ["who 常指人，which 指事物，that 可用于许多限定性定语从句。先找被解释的人或事物，再加相关信息。", "The café serves sandwiches. The café is near my house. 可以写 The café that serves sandwiches is near my house.", "关系词已充当从句主语时，不再加 he/it：a café that serves lunch，不是 that it serves lunch。本课先练不带逗号、用于识别对象的从句。"],
    examples: [["I have a friend who loves science.", "who loves science 说明什么样的朋友。"], ["We can visit a museum that has a dinosaur exhibition.", "从句补充推荐理由相关的细节。"]],
    mistake: ["I know a boy who he plays chess.", "I know a boy who plays chess.", "who 已经作从句主语，不再加 he。"],
    questions: [question("The girl ___ won the race is my friend.", ["who", "where", "what"], "who", "先行词是人。"), question("Choose the correct phrase.", ["a shop that it sells books", "a shop that sells books", "a shop where sells books"], "a shop that sells books", "that 直接作 sells 的主语。")],
    sentence: "合并：I like the park. The park has a lake. 再介绍一位有特别爱好的朋友。", paragraph: "推荐一个地方，写位置、特色和推荐原因，使用一个自然的定语从句。", model: "There is a park near our school that has a large lake. We could take photos there because the view is beautiful.", checklist: ["关系词指代清楚", "没有重复 he/it", "补充的细节帮助读者理解"]
  },
  {
    id: "c-passive", kind: "grammar", title: "08 · 主动与被动", goal: "在介绍地点、规则和活动时选择合适主语。",
    teaching: ["主动强调谁做事：Volunteers clean the park. 被动强调受动作影响的事物：The park is cleaned by volunteers.", "一般现在时被动：am/is/are + 过去分词；一般过去时被动：was/were + 过去分词。过去分词不一定加 -ed，例如 build → built。", "情态动词被动：must/can + be + 过去分词，如 Tickets must be booked online. 不必为了句式变化，把每句都改成被动。"],
    examples: [["The museum was built in 1998.", "介绍建筑历史，主体是 museum。"], ["Food can be bought at the café.", "说明服务安排。"]],
    mistake: ["The museum built in 1998.", "The museum was built in 1998.", "博物馆是被建造的，需要 was built。"],
    questions: [question("The rooms ___ every day.", ["clean", "are cleaned", "was cleaned"], "are cleaned", "复数主语，日常被动。"), question("Tickets must ___ in advance.", ["booked", "be booked", "be booking"], "be booked", "must + be + 过去分词。")],
    sentence: "改写：People built this bridge in 2010. 再用 must be 写一条借书规则。", paragraph: "介绍一个景点的历史和参观规则，写 3 句，至少一句主动、一句被动。", model: "The castle was built over three hundred years ago. Visitors can explore the gardens. Tickets must be shown at the entrance.", checklist: ["保留 be 动词", "过去分词正确", "时态与时间一致"]
  },
  {
    id: "c-links", kind: "grammar", title: "09 · 原因、转折、目的与结果", goal: "先想清关系，再选连接词。",
    teaching: ["because 接原因，so 引出结果。通常不用 because 和 so 同时连接同一对分句。", "although 表示虽然：Although it was cold, we went out. 通常不再加 but。so that + 句子可表达目的；to + 原形也能表达目的。", "unless 表示‘除非/如果不’。先用中文检查逻辑，再选择 unless 或 if。连接词不需要每句都用。"],
    examples: [["Bring a jacket because it may get cold.", "理由与建议相连。"], ["Let's leave early so that we can get good seats.", "so that 后写希望达到的目的。"]],
    mistake: ["Although it was raining, but we enjoyed the trip.", "Although it was raining, we enjoyed the trip.", "同一结构不用 although 与 but 重复连接。"],
    questions: [question("___ it was expensive, I enjoyed the meal.", ["Although", "Because", "So"], "Although", "价格高与仍然喜欢形成让步。"), question("We'll miss the bus ___ we leave now.", ["because", "unless", "although"], "unless", "除非现在走，否则会错过。")],
    sentence: "合并：We left early. We wanted to catch the train. 再写一句 although 表达转折。", paragraph: "推荐一次有优点也有不足的活动，说明为什么仍值得参加。", model: "Although the museum is small, it has some fascinating models. We should arrive early so that we have enough time to try the activities.", checklist: ["连接关系合理", "没有 although…but 重复", "目的后有完整内容"]
  },
  {
    id: "c-compare", kind: "grammar", title: "10 · 比较、数量和程度", goal: "为选择活动提供清楚的比较。",
    teaching: ["两者比较用比较级 + than：cheaper than。as + 原级 + as 表示同样……；not as…as 表示不如。", "fewer 配可数复数，less 配不可数名词：fewer people、less time。many 配可数名词，much 配不可数名词。", "too + 形容词 + to do 表示太……而不能；形容词 + enough + to do 表示足够……可以。enough 在名词前：enough time。"],
    examples: [["Cycling is cheaper than taking a taxi.", "比较交通选择。"], ["The bag is light enough to carry.", "enough 在形容词 light 后。"]],
    mistake: ["The ticket is more cheaper.", "The ticket is cheaper.", "不要同时用 more 和 -er 表示同一次比较。"],
    questions: [question("We have ___ time today than yesterday.", ["fewer", "less", "many"], "less", "time 在此不可数。"), question("The water is too cold ___ in.", ["swim", "swimming", "to swim"], "to swim", "too…to do。")],
    sentence: "比较两个活动的费用和距离；用 enough 写一句说明时间是否充足。", paragraph: "在看电影和去公园之间做选择，给出两项具体比较和最终建议。", model: "The park is closer than the cinema, and we don't need to buy tickets. We have enough time to walk there, so I think it is a better choice.", checklist: ["比较级形式正确", "可数与不可数分清", "选择有具体依据"]
  },
  {
    id: "c-modal", kind: "grammar", title: "11 · 建议、禁止与可能", goal: "区分 should、mustn't、don't have to 和 might。",
    teaching: ["should + 原形常用于建议；must 表示强烈义务，mustn't 表示禁止。语气强度不同，不应随意互换。", "don't have to 表示不必，不是禁止：You don't have to bring food 意味着带不带都可以。", "may/might 表示可能，不能把不确定的事情写成肯定事实。向朋友提议可用 We could…；语气自然比堆生词更重要。"],
    examples: [["You should bring comfortable shoes.", "旅行建议。"], ["We might need a jacket, but we don't have to bring lunch.", "可能需要与不必做的事分开说。"]],
    mistake: ["You mustn't pay. The event is free.", "You don't have to pay. The event is free.", "免费表示无需付款，不是在制定禁止付款的规则。"],
    questions: [question("The sign says 'No photos'. You ___ take photos.", ["mustn't", "don't have to", "might"], "mustn't", "标牌禁止拍照。"), question("I'm not sure, but it ___ rain later.", ["mustn't", "might", "has to"], "might", "表达不确定的可能性。")],
    sentence: "给朋友写一条建议、一条规则和一项不必携带的东西，分别使用合适结构。", paragraph: "为第一次参加学校旅行的朋友写 3—4 句准备提醒，说明原因。", model: "You should wear comfortable shoes because we'll walk a lot. You don't have to bring lunch, as the school will provide it. You mustn't leave the group without telling a teacher.", checklist: ["禁止与不必不混淆", "情态动词后接原形", "语气适合读者和任务"]
  },
  {
    id: "w-arrange", kind: "writing", title: "01 · 邮件：把安排写清楚", goal: "用准确的信息回答对方，而不是只说有很多好玩的地方。",
    teaching: ["先圈题目中每个需要回应的要点，为每个要点写一句核心信息。地点、时间和活动各不相同，不要用活动介绍代替集合时间。", "安排可用 Let's meet… 或 We could…；补足 at ten、outside the library 等细节。时间地点由练习情境决定，不机械照抄。", "给朋友写信要自然、友好。清楚的短句能完成任务，不需要每句都是复杂句。完成后逐项对照题目。"],
    examples: [["Let's meet outside the library at ten on Saturday.", "一句给出具体地点和时间。"], ["We could visit the market because you enjoy trying local food.", "提议与朋友的兴趣关联。"]],
    mistake: ["We can meet somewhere in the morning.", "Let's meet outside the cinema at ten on Saturday morning.", "原句语法不一定错，但安排不够具体。修改须符合题目情境。"],
    questions: [question("朋友问何时见面，哪句回应完整？", ["There are many parks.", "Let's meet at ten on Saturday.", "The film is exciting."], "Let's meet at ten on Saturday.", "直接回答时间。"), question("给朋友的自然提议是？", ["We could visit the park together.", "You are hereby required to attend.", "The aforementioned activity is compulsory."], "We could visit the park together.", "语气友好并适合普通邀请邮件。")],
    sentence: "朋友周日下午来访。写两句：在图书馆门口两点集合；一起去公园，并解释原因。", paragraph: "写 40—60 词邮件正文，回应集合时间、地点、活动和需要携带的东西。", model: "Let's meet outside the library at two on Sunday afternoon. We could walk to the park because you enjoy taking photos. Please bring your camera and a water bottle. If it rains, we can visit the museum instead.", checklist: ["所有指定要点有回应", "时间地点具体", "语气友好", "没有遗漏 be 和 your"]
  },
  {
    id: "w-reason", kind: "writing", title: "02 · 观点后补理由和例子", goal: "把 good、fun、interesting 展开成有内容的表达。",
    teaching: ["先说选择或观点，再问自己 Why? 给出与主题有关的理由，不要只重复‘因为很好玩’。", "再补一个具体细节或例子。可以写能做什么、对自己有什么帮助，或一次真实经历。", "because 是一种连接方法，也可以分成两个句子。重点是内容有发展，不是计算用了几个连接词。"],
    examples: [["I enjoy cycling because it helps me relax after school.", "活动 + 对自己的具体作用。"], ["At weekends, I often ride along the river with my dad.", "用个人细节支持前面的爱好。"]],
    mistake: ["The club is good because it is very good.", "The club is useful because I can practise speaking with other students.", "把循环重复改成具体收益。"],
    questions: [question("哪项理由最具体？", ["It is nice because it is nice.", "It helps me learn how to build simple robots.", "It is very, very good."], "It helps me learn how to build simple robots.", "说明学到什么。"), question("文章主题是最喜欢的运动，哪项细节最相关？", ["My pencil case is blue.", "I play basketball with my classmates every Friday.", "My neighbour has a cat."], "I play basketball with my classmates every Friday.", "细节支持主题，没有跑题。")],
    sentence: "把 I like reading. 扩展成观点、理由、个人例子三句，内容由你决定。", paragraph: "写 40—60 词，推荐一种课后爱好，说明两个好处并加入一个个人细节。", model: "I enjoy reading adventure stories because they help me imagine different places. I usually read for twenty minutes before bed. Last week, I finished a story about a journey across the sea and discussed it with a friend.", checklist: ["理由不只是重复观点", "至少一个具体细节", "所有内容与主题相关"]
  },
  {
    id: "w-plan", kind: "writing", title: "03 · 建议、询问与备用方案", goal: "让邮件形成真正的交流。",
    teaching: ["建议写 We could… 或 Why don't we…? 接一个原因，让对方知道为什么这样安排。", "缺少信息时提出有用的问题，如 Could you tell me what time…? 检查间接问句的语序。", "需要时用 If… 写备用方案。没有雨天要求也没有相关情境时，不要为了展示句型硬插雨天安排。"],
    examples: [["We could take the bus because it stops near the museum.", "建议 + 实际理由。"], ["Could you tell me whether I need to book a ticket?", "询问行动前需要的信息。"]],
    mistake: ["Could you tell me what time does the club start?", "Could you tell me what time the club starts?", "间接问句改为陈述语序。"],
    questions: [question("哪句可作合理雨天预案？", ["If it rains, we can play indoors.", "If it rains, it rained yesterday.", "If will rain, we inside."], "If it rains, we can play indoors.", "条件与替代活动有联系，结构完整。"), question("哪句礼貌问询正确？", ["Could you tell me where we meet?", "Could you tell me where do we meet?", "Could you tell where meet?"], "Could you tell me where we meet?", "where 后使用陈述语序。")],
    sentence: "向朋友建议一个活动并给理由，再询问需要带什么。", paragraph: "写 40—60 词邀请朋友打球，说明安排、雨天替代活动，并询问他是否有空。", model: "We could play basketball at the park on Saturday morning because the court is usually quiet then. If it rains, we can go to the indoor sports centre. Could you let me know whether you're free?", checklist: ["建议与理由相连", "问题清楚且有用", "if 从句不用多余 will"]
  },
  {
    id: "w-article", kind: "writing", title: "04 · 文章：从句子到段落", goal: "围绕题目写观点和细节，保持读者兴趣。",
    teaching: ["先列出题目要求回答的问题。文章通常面向某类读者，开头让读者知道主题，正文逐项回答。", "一个段落集中说明一个重点：主题句 → 理由或经历 → 相关细节。可以用比较或定语从句补信息，但保持清楚。", "结尾可给推荐或简短感受。文章不需要 Dear… 和 Yours…，也不要把邮件称呼照搬过来。"],
    examples: [["My favourite place is a park that has a small lake.", "主题句中补一个具体特色。"], ["It is quieter than the sports centre, so it is a good place to relax.", "比较帮助解释推荐理由。"]],
    mistake: ["Dear readers, Yours, Tom.", "A Great Place to Relax", "本例展示文体调整：可以用合适标题，不必套用私人信件格式。"],
    questions: [question("文章问喜欢哪里以及原因，哪组内容最完整？", ["地点、两个理由和相关细节", "只写交通方式", "只列十个地名"], "地点、两个理由和相关细节", "内容回应地点及原因。"), question("哪个结尾最适合推荐活动的文章？", ["Yours sincerely, Leo", "Why not try it with a friend this weekend?", "Please reply to my email immediately."], "Why not try it with a friend this weekend?", "自然地面向读者提出推荐。")],
    sentence: "介绍一个喜欢的地方，用 that/who 或比较级补一个有用细节。", paragraph: "先写 40—60 词主体段，再扩展成约 100 词文章：你最喜欢在哪里度过周末？为什么？你在那里做什么？", model: "My favourite place is a park that has a small lake. It is quieter than the town centre, so I can relax there. I usually ride my bike around the lake with my brother. Sometimes we stop to take photos of the birds.", checklist: ["回应文章的全部问题", "每段围绕一个重点", "例子具体", "没有套用邮件结尾"]
  },
  {
    id: "w-story", kind: "writing", title: "05 · 故事：背景、事件和结果", goal: "让故事连贯，读者知道发生了什么。",
    teaching: ["先确定人物、地点和时间。若题目提供开头句，要接着它发展情节，不能另起一个无关故事。", "过去进行时适合交代背景，一般过去时推进事件。可用 when、while、a few minutes later 等连接时间。", "写出一个问题或变化，再写人物如何行动以及结果。感受要有原因，不能只堆 happy、excited、amazed。"],
    examples: [["While I was looking for my ticket, the train arrived.", "背景与突然出现的事件。"], ["I felt relieved when my friend found it in my bag.", "感受有明确原因。"]],
    mistake: ["Yesterday I walk to the station and see my friend.", "Yesterday I walked to the station and saw my friend.", "故事发生在昨天，两个动作都应保持过去时间。"],
    questions: [question("选择完整的故事推进顺序。", ["结果 → 无关介绍 → 新人物", "背景 → 问题 → 行动 → 结果", "只列形容词"], "背景 → 问题 → 行动 → 结果", "让读者理解事件的联系。"), question("I was opening the box when I ___ a sound.", ["hear", "heard", "have heard"], "heard", "过去事件与背景动作配合。")],
    sentence: "用 while/when 写背景与突然事件，再写一句由事件引起的感受。", paragraph: "接着开头句写 40—60 词情节，再扩展成约 100 词故事：When I opened the bag, I realised it wasn't mine.", model: "I was standing outside the sports centre. Inside the bag, I found a notebook with a phone number. I called the owner, who was waiting at the bus stop. A few minutes later, we exchanged our bags. We both laughed with relief.", checklist: ["承接给定开头", "过去时态一致", "事件有因果或时间联系", "有清楚的结果"]
  },
  {
    id: "w-edit", kind: "writing", title: "06 · 写完后怎样提分", goal: "按内容、表达、组织、语言检查，留下真实修改记录。",
    teaching: ["第一遍检查任务：每个要点都回应了吗？读者能据此行动吗？遗漏集合时间时，先补信息，再润色词语。", "第二遍检查组织与表达：分段合理吗？前后矛盾吗？代词指谁？语气适合朋友、文章读者或故事吗？", "第三遍检查语言：主语谓语、be、时态、单复数、your、动词形式和拼写。先修影响理解的错误，再考虑变化句式。复杂句不是固定加分项，也没有单句保分承诺。"],
    examples: [["The cinema is close to my house, so we can walk there.", "先完整，再用有逻辑的连接说明结果。"], ["I enjoy watching films with friends because we can discuss the story afterwards.", "动词形式正确，并补具体理由。"]],
    mistake: ["I think watch films is so fun. Bring you bottle.", "I think watching films is fun. Bring your bottle.", "修正动名词和物主代词后，再按任务需要补细节。"],
    questions: [question("作文漏掉题目要求的集合时间，先做什么？", ["补上具体时间", "加入五个高级词", "把所有句子加长"], "补上具体时间", "先完成交际任务。"), question("哪项是合理的句型升级？", ["每句强行使用 although", "用相关细节说明为什么推荐某活动", "照背一段与题目无关的范文"], "用相关细节说明为什么推荐某活动", "准确、相关、有发展才有帮助。")],
    sentence: "修改：The library near my house. We can meet there. I enjoy read books. 要求补上周六十点集合。", paragraph: "选一篇自己的旧作文。保留原稿，先标出遗漏信息和三处语言问题，再写修改稿并解释修改理由。", model: "The library is near my house. Let's meet outside it at ten on Saturday morning. I enjoy reading adventure stories, and I'd like to show you my favourite books.", checklist: ["保留独立原稿", "补齐题目要求", "检查基础语言错误", "每处升级都有表达目的"]
  }
];

export interface LessonWork { answers: Record<string,string>; checked: boolean; sentence: string; original: string; submitted: boolean; feedback: string; revision: string; reviewed: boolean }
export const blankLesson = (): LessonWork => ({ answers:{}, checked:false, sentence:"", original:"", submitted:false, feedback:"", revision:"", reviewed:false });
export function validLessons(value: unknown): boolean {
  if (value === undefined) return true; // Backups created before courses remain readable.
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).length <= LESSONS.length && Object.entries(value).every(([id, raw]) => {
    const lesson = LESSONS.find(l => l.id === id); const w = raw as LessonWork;
    return !!lesson && !!w && typeof w === "object" && [w.checked,w.submitted,w.reviewed].every(v=>typeof v === "boolean") && [w.sentence,w.original,w.feedback,w.revision].every(v=>typeof v === "string" && v.length <= 10000) && !!w.answers && typeof w.answers === "object" && !Array.isArray(w.answers) && Object.entries(w.answers).every(([i,a])=>/^\d+$/.test(i) && !!lesson.questions[Number(i)] && lesson.questions[Number(i)].choices.includes(a));
  });
}
export function lessonMaterials(lesson: Lesson, work: LessonWork): string {
  return [`PET 手工点评 · ${lesson.title}`, `目标：${lesson.goal}`, `句子任务：${lesson.sentence}`, `我的句子：${work.sentence}`, `段落/写作任务：${lesson.paragraph}`, `独立原稿：\n${work.original}`, `已有点评：\n${work.feedback}`, `修改稿：\n${work.revision}`, `自查项目：${lesson.checklist.join("；")}`, "请检查任务回应、表达清晰度、组织和语言；逐处解释修改理由，给出下一次练习建议。不要把单句练习换算成考试分数。"].join("\n\n");
}
