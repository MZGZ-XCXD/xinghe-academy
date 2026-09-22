import type { GameState, TutorialStep } from '../game/types'
import { calendarFromMinutes } from '../game/formulas'

type S = GameState

const anyCourseActive = (s: S) => Object.values(s.courses).some((c) => c.active)
const anyTech = (s: S) => Object.values(s.technologies).some((t) => t.unlocked)
const anyPolicy = (s: S) => s.school.activePolicies.length > 0
const anyEventHandled = (s: S) => s.statistics.eventsResolved > 0 || s.events.log.length > 0
const anyActivity = (s: S) => s.statistics.competitions > 0 || s.statistics.exchanges > 0
const anyClub = (s: S) => Object.values(s.clubs).some((c) => c.level > 0)
const anyTeam = (s: S) => Object.values(s.teams).some((t) => t.founded)
const exchangeTech = (s: S) =>
  s.technologies.schoolExchange?.unlocked === true || s.technologies.intlExchange?.unlocked === true
const firstYearDone = (s: S) => s.school.lastAnnualReport != null || calendarFromMinutes(s.time.minutes).schoolYear >= 2
const anyAchievement = (s: S) => Object.values(s.achievements).some((a) => a.unlocked)
const legacyReady = (s: S) => s.school.rating >= 40 || s.statistics.graduates >= 100
const freedom = (s: S) => s.school.rating >= 52 && s.statistics.graduates >= 200

/**
 * 剧情引导：新存档与每次「学园传承」之后都会从第一章重新播放。
 *
 * 改内容时请守住三条约定，否则任务面板会指向做不到的事：
 * 1. 每一章的 `objective` = 「做什么才能让这一章翻页」= 它的 `trigger` 条件；
 * 2. 每一章的故事在**这一章达成时**弹出，所以故事结尾要引出**下一章**的任务；
 * 3. `unlocks` 也在该章达成时生效，因此它应该解锁**下一章任务需要用到**的界面。
 *
 * 另外：剧情引导没走完之前不刷随机事件（见 EventEngine.rollRandomEvent），
 * 需要让玩家体验事件的章节用 `demoEvent` 直接派发一件剧本事件。
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'letter',
    objective: '读完这封信',
    tab: 'buildings',
    chapter: '第一章 · 一封信',
    title: '远房亲戚的信',
    icon: '✉️',
    paragraphs: [
      '你收到一封手写的信。寄信人是你只在葬礼上见过两次的远房亲戚——他在城郊办了三十年学，如今病退，学校里只剩下半栋教学楼和一批还没毕业的孩子。',
      '你本想拒绝。可信的最后夹着一张照片：操场上站着十几个学生，校服洗得发白，脸上的表情却很认真。他们在等一个校长。',
      '第二天清晨，你站在了那扇掉了漆的校门口。今天只做一件事：去【建筑】里升级教学楼。',
    ],
    // 开场信：新存档 / 每次传承后必定触发
    trigger: () => true,
  },
  {
    id: 'firstBuilding',
    objective: '在【建筑】里升级一次教学楼',
    tab: 'buildings',
    chapter: '第二章 · 只剩几位老师',
    title: '教务处的名单',
    icon: '🧑‍🏫',
    paragraphs: [
      '教学楼修好了。教务处那位老教师把一份名单推到你面前：全校只剩十几位老师，最年轻的也四十多岁了。',
      '「课还是得开。」她说，「你排课，我们就上。」',
      '【课程】已经打开。开课后学生才会真正开始成长，同时会持续消耗教学资源——所以开几门、开给哪些年级，是要算账的。',
    ],
    trigger: (s) => s.statistics.buildingsBuilt >= 1,
    unlocks: ['courses', 'students'],
  },
  {
    id: 'firstCourse',
    objective: '在【课程】里开设第一门课（语文或数学）',
    tab: 'courses',
    chapter: '第三章 · 第一张课表',
    title: '黑板上的字',
    icon: '📚',
    paragraphs: [
      '第一节课的铃声响起来的时候，你正站在走廊上。教室里有人在念课文，声音不整齐，但没有一个人缺席。',
      '一门课能让学生成长，也能把教学资源花光。等攒下一点家底，就去【科技】看看——对这样一所学校来说，那是唯一能真正追上别人的办法。',
    ],
    trigger: anyCourseActive,
    unlocks: ['tech'],
  },
  {
    id: 'firstTech',
    objective: '在【科技】里研究第一项科技（推荐「现代教学」）',
    tab: 'tech',
    chapter: '第四章 · 教研与改革',
    title: '第一次教研会',
    icon: '🔬',
    paragraphs: [
      '第一次教研会开到很晚。有人提出要做实验课，有人担心经费，也有人说：「先做吧，做坏了再改。」',
      '科技会陆续解锁新的课程、建筑与校规。不过一所学校除了课程，还需要「规矩」——【校规】现在可以用了，每一条都有好处，也都有代价。',
    ],
    trigger: anyTech,
    unlocks: ['policies'],
  },
  {
    id: 'firstPolicy',
    objective: '在【校规】里施行一条校规',
    tab: 'policies',
    chapter: '第五章 · 规矩的代价',
    title: '写进校规的那条',
    icon: '📜',
    paragraphs: [
      '校规抄在教务处墙上的那一刻，走廊里明显安静了一点。有人不满意，但没人反对——这所学校的作息终于像个学校了。',
      '接下来会有人来找你拍板：食堂的抱怨、老师的申请、邻校的邀请。它们会以浮窗的形式直接出现在屏幕上，每个选项都写清了代价与后果。',
      '处理完这一件，校园里的杂事就会陆续找上门来。',
    ],
    trigger: anyPolicy,
    unlocks: ['events'],
  },
  {
    id: 'firstEvent',
    objective: '处理一次校园事件（浮窗里选一个方案）',
    tab: 'events',
    chapter: '第六章 · 走廊上的声音',
    title: '第一件杂事',
    icon: '📰',
    paragraphs: [
      '你发现校长室的门几乎关不上：有人拿着单子进来，有人拿着名单出去。这就是经营一所学校真正的样子。',
      '事件有长有短，可以当场拍板，也可以点「稍后处理」——它会留在【事件】里等你。选择不同，学生的情绪、老师的状态、甚至几年后的校友都会不一样。',
      '现在，先让校园像个校园：再去【建筑】里建一栋楼。',
    ],
    trigger: anyEventHandled,
    demoEvent: 'tutorialErrand',
    unlocks: ['competitions'],
  },
  {
    id: 'firstGrowth',
    objective: '把校园建到第 3 栋建筑',
    tab: 'buildings',
    chapter: '第七章 · 别人的学校',
    title: '邀请函',
    icon: '🏆',
    paragraphs: [
      '邻校寄来一封邀请函：下个月有一场联赛，问你们要不要来。',
      '输赢不重要，重要的是让孩子们知道自己站在什么位置上。【活动】已经开放，派学生出去比赛会消耗时间与资源，失败也会带回经验与压力。',
    ],
    trigger: (s) => s.statistics.buildingsBuilt >= 3,
    unlocks: ['clubs'],
  },
  {
    id: 'firstActivity',
    objective: '在【活动】里派学生出去比赛或交流一次',
    tab: 'competitions',
    chapter: '第八章 · 第一场比赛',
    title: '大巴车上的歌声',
    icon: '🚌',
    paragraphs: [
      '去比赛的大巴车上，学生们一路在唱歌，回来时唱得更大声——他们赢了。',
      '比赛与交流的奖励会变成资源、声望，偶尔还有一张效果卡。不过学校的另一半还没开始运转：下午三点半以后的那些社团。',
      '只是成立社团要花「🎈 学生活跃度」，而现在学校一点也没有——它只有把【中庭广场】建起来之后才会开始累积（需要教学楼 Lv.2，建成后约 +0.9 / 游戏分钟）。攒到 90 点，动漫社就能挂牌。',
    ],
    trigger: anyActivity,
    unlocks: ['teams'],
  },
  {
    id: 'firstClub',
    objective: '先在【建筑】建起中庭广场（学生活跃度来源），再到【社团】成立第一个社团',
    tab: 'buildings',
    chapter: '第九章 · 三点半以后',
    title: '部活的钟声',
    icon: '🎽',
    paragraphs: [
      '下午三点半，教学楼突然热闹起来。动漫社在走廊贴海报，轻音社把音箱搬到了中庭，超自然研究社的人蹲在旧楼梯口数台阶。',
      '【社团】占用部室、消耗一点经费，却带来学生成长、资源产出与「学园祭评分」。社团练到一定程度，里面的学生就会申请成立校队。',
    ],
    trigger: anyClub,
    unlocks: ['statistics', 'exchange'],
  },
  {
    id: 'firstTeam',
    objective: '把社团练强后上报成立第一支校队',
    tab: 'teams',
    chapter: '第十章 · 校队',
    title: '她们想出去比一场',
    icon: '🥋',
    paragraphs: [
      '社团里最强的几个人来找你。她们说：「我们想去外面比一场。」',
      '于是学校第一次有了校队。队伍需要日常训练累积实力，再从邻校友谊赛开始一级一级往上打；队名可以自己起，也可以从推荐里挑。',
      '高三队员会在某个冬天退役——那是另一件事了。',
      '等学年结束，【统计】里会生成这一届学生的完整报告。先撑过第一个学年吧。',
    ],
    trigger: anyTeam,
  },
  {
    id: 'firstYear',
    objective: '撑过第一个学年，看一次学年结算',
    tab: 'statistics',
    chapter: '第十一章 · 毕业那天',
    title: '第一届毕业生',
    icon: '🎓',
    paragraphs: [
      '六月的操场很晒。高三学生排成一排，从你手里接过毕业证，有人握手很用力。',
      '他们变成校友，会在很多年以后以各种方式回来。学校的【统计】里也开始有了历史。下一件事在校门外：去【科技】研究「校际交流」，然后到【交流】里派学生出去。',
    ],
    trigger: firstYearDone,
    unlocks: ['achievements'],
  },
  {
    id: 'exchange',
    objective: '研究「校际交流」并派学生出去一次（【科技】→【交流】）',
    tab: 'exchange',
    chapter: '第十二章 · 走出校门',
    title: '来访的学校',
    icon: '🤝',
    paragraphs: [
      '第一所来访的学校比你们大得多。他们的学生在你们的中庭站了半小时，然后说：「你们这儿挺有意思的。」',
      '【交流】可以派学生出去，也可以请别人进来。国际交流需要更多准备，但能带来这所学校以前不敢想的东西。',
      '另外，荣誉展览馆的墙上还空着——【成就】里攒下的每一件事，都会被挂上去。',
    ],
    trigger: exchangeTech,
    unlocks: ['legacy'],
  },
  {
    id: 'firstAchievement',
    objective: '完成任意一个成就',
    tab: 'achievements',
    chapter: '第十三章 · 墙上的照片',
    title: '做过的事',
    icon: '🏅',
    paragraphs: [
      '荣誉展览馆的墙上开始有照片了：第一届毕业班、第一次区级比赛、某个深夜还亮着的实验室。',
      '【成就】会记录你做过的每一件小事，完成时给传承点与永久加成。顺便说一句：学校评级每升一级都要过一次督导考核，别急着冲。',
      '等学校评级到 40（或毕业生累计到 100 人），就该谈谈「传承」了。',
    ],
    trigger: anyAchievement,
  },
  {
    id: 'legacy',
    objective: '把学校评级提到 40，或累计毕业生达到 100 人',
    tab: 'legacy',
    chapter: '第十四章 · 传承',
    title: '老校长的笔记',
    icon: '🕯️',
    paragraphs: [
      '整理仓库时，你翻到一本皮面笔记本。是那位远房亲戚留下的：哪栋楼该先修、哪个老师不能放走、哪一届学生最难带。',
      '当学校评级与毕业生数量达到要求，你可以选择「学园传承」——结束这一轮，带着经验重新开始。传承点与传承树不会重置。',
    ],
    trigger: legacyReady,
  },
  {
    id: 'free',
    objective: '按自己的路线把学校办下去',
    tab: 'campus',
    chapter: '第十五章 · 自由经营',
    title: '你自己的学校',
    icon: '🌅',
    paragraphs: [
      '到这一步，你手里已经是一所像样的学校了。接下来没有剧本：科研、体育、文化、国际，挑一条路走到底。',
      '嫌节奏慢可以在顶部切换 2× / 5× 速度；离开一段时间回来，会结算离线收益。',
      '校史由你写。',
    ],
    trigger: freedom,
  },
]

export const TUTORIAL_MAP: Record<string, TutorialStep> = TUTORIAL_STEPS.reduce(
  (acc, step) => {
    acc[step.id] = step
    return acc
  },
  {} as Record<string, TutorialStep>,
)
