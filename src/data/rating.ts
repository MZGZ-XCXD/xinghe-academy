import type { GameState, RatingExamDef, ResourceKey } from '../game/types'
import { averageTeacherQuality, overallAttributes, totalStudents, totalTeachers, totalClubLevels } from '../game/formulas'

export interface RatingTier {
  index: number
  min: number
  label: string
}

/** 评级等级：数值到门槛后必须通过考核才能继续往上走 */
export const RATING_TIERS: RatingTier[] = [
  { index: 0, min: 0, label: '待整改高中' },
  { index: 1, min: 20, label: '普通高中' },
  { index: 2, min: 35, label: '区级示范高中' },
  { index: 3, min: 50, label: '市级示范高中' },
  { index: 4, min: 62, label: '省级重点高中' },
  { index: 5, min: 74, label: '全国名校' },
  { index: 6, min: 86, label: '国际知名实验校' },
  { index: 7, min: 95, label: '世界实验标杆校' },
]

const techCount = (s: GameState) => Object.values(s.technologies).filter((t) => t.unlocked).length
const clubCount = (s: GameState) => Object.values(s.clubs).filter((c) => c.level > 0).length
const buildingLevel = (s: GameState, id: string) => s.buildings[id]?.level ?? 0

/**
 * 每次评级升级都要经过一次考核：督导组带着清单来学校，逐项核对。
 * 没通过考核前，评级数值会被锁在当前等级的上限之下。
 */
export const RATING_EXAMS: RatingExamDef[] = [
  {
    tierIndex: 1,
    name: '办学基本条件核查',
    title: '第一次评估',
    icon: '📋',
    examiner: '区教育局督导组',
    paragraphs: [
      '两位督导员在校门口站了很久，先看了看那块掉了漆的校牌，又看了看操场。',
      '「学校还活着。」其中一位说，「那就按基本条件核一遍吧：有学生、有老师、有教室上课。」',
    ],
    requirements: [
      { label: '在校学生 ≥ 140 人', check: (s) => totalStudents(s) >= 140 },
      { label: '学生平均学术 ≥ 28', check: (s) => overallAttributes(s).academic >= 28 },
      { label: '教学楼 Lv.2', check: (s) => buildingLevel(s, 'teachingBuilding') >= 2 },
    ],
    reward: { educationFund: 3000, reputation: 20 },
  },
  {
    tierIndex: 2,
    name: '区级示范高中评定',
    title: '区里的名单',
    icon: '🏅',
    examiner: '区级示范校评审组',
    paragraphs: [
      '「区里今年只有一个示范校名额。」评审组长把材料推过来，「你们连图书馆都没建完。」',
      '老教师在你身后小声说：「我们以前连这个门都进不来。」',
    ],
    requirements: [
      { label: '在校学生 ≥ 180 人', check: (s) => totalStudents(s) >= 180 },
      { label: '学生平均学术 ≥ 33', check: (s) => overallAttributes(s).academic >= 33 },
      { label: '教师队伍 ≥ 18 人且平均能力 ≥ 48', check: (s) => totalTeachers(s) >= 18 && averageTeacherQuality(s) >= 48 },
      { label: '图书馆 Lv.2', check: (s) => buildingLevel(s, 'library') >= 2 },
      { label: '完成 2 项科技研究', check: (s) => techCount(s) >= 2 },
    ],
    reward: { educationFund: 12000, reputation: 60 },
  },
  {
    tierIndex: 3,
    name: '市级示范高中评定',
    title: '全市的赛场',
    icon: '🏙️',
    examiner: '市教育局评估中心',
    paragraphs: [
      '评估中心的人带了一整套仪器：测课表、测社团、测学生体检数据，还随机点了三个学生去做实验。',
      '「你们的体育和艺术比我想的好。」他在记录本上写下最后一行，「但还差一点别的。」',
    ],
    requirements: [
      { label: '在校学生 ≥ 260 人', check: (s) => totalStudents(s) >= 260 },
      { label: '学生平均学术 ≥ 40', check: (s) => overallAttributes(s).academic >= 40 },
      {
        label: '体育 / 艺术 / 科研 任一 ≥ 38',
        check: (s) => {
          const a = overallAttributes(s)
          return a.sports >= 38 || a.arts >= 38 || a.research >= 38
        },
      },
      { label: '完成 6 项科技研究', check: (s) => techCount(s) >= 6 },
      { label: '拥有 4 个以上社团', check: (s) => clubCount(s) >= 4 },
      { label: '累计 3 次比赛胜利', check: (s) => s.statistics.competitionWins >= 3 },
    ],
    reward: { educationFund: 40000, reputation: 150, influence: 25 },
  },
  {
    tierIndex: 4,
    name: '省级重点高中评定',
    title: '省里的队伍',
    icon: '🚄',
    examiner: '省级重点中学评估委员会',
    paragraphs: [
      '省里的评估委员会来了七个人，其中一位是二十年前从这个区另一所学校毕业的。',
      '他们查了三个小时的材料，最后问了一句：「你们的毕业生，现在都在做什么？」',
    ],
    requirements: [
      { label: '在校学生 ≥ 350 人', check: (s) => totalStudents(s) >= 350 },
      { label: '学生平均学术 ≥ 50', check: (s) => overallAttributes(s).academic >= 50 },
      { label: '累计毕业生 ≥ 200 人', check: (s) => s.statistics.graduates >= 200 },
      { label: '完成 12 项科技研究', check: (s) => techCount(s) >= 12 },
      { label: '拥有 8 个以上社团', check: (s) => clubCount(s) >= 8 },
      { label: '累计 12 次比赛胜利', check: (s) => s.statistics.competitionWins >= 12 },
    ],
    reward: { educationFund: 120000, reputation: 300, influence: 80 },
  },
  {
    tierIndex: 5,
    name: '全国名校评估',
    title: '全国同行',
    icon: '🏆',
    examiner: '国家教育评估专家组',
    paragraphs: [
      '专家组的飞机晚点了五个小时，到学校时已经是傍晚。他们在中庭站了一会儿，看学生社团自己组织的放映会。',
      '「明天上午我们看课，下午看实验室。」组长说，「不用准备，我们想看平时什么样。」',
    ],
    requirements: [
      { label: '在校学生 ≥ 500 人', check: (s) => totalStudents(s) >= 500 },
      { label: '学生平均学术 ≥ 60', check: (s) => overallAttributes(s).academic >= 60 },
      { label: '学生平均科研 ≥ 55', check: (s) => overallAttributes(s).research >= 55 },
      { label: '累计毕业生 ≥ 600 人', check: (s) => s.statistics.graduates >= 600 },
      { label: '完成 20 项科技研究', check: (s) => techCount(s) >= 20 },
      { label: '有队伍打入过全国大赛', check: (s) => s.statistics.flags.teamTier_national === true },
    ],
    reward: { educationFund: 400000, reputation: 700, influence: 200 },
  },
  {
    tierIndex: 6,
    name: '国际交流资格评定',
    title: '来自海外的信',
    icon: '🌐',
    examiner: '国际教育交流评审团',
    paragraphs: [
      '评审团里有一位不会说中文的观察员。他在走廊上被学生拦住，用不太流利的英语聊了二十分钟课题。',
      '离开前他在评估表上写了一行：「这里的走廊是可以聊学术的地方。」',
    ],
    requirements: [
      { label: '在校学生 ≥ 700 人', check: (s) => totalStudents(s) >= 700 },
      { label: '学生平均学术 ≥ 70', check: (s) => overallAttributes(s).academic >= 70 },
      { label: '国际声誉 ≥ 300', check: (s) => s.resources.intlReputation >= 300 },
      { label: '完成 30 项科技研究', check: (s) => techCount(s) >= 30 },
      { label: '成功举办过学园祭', check: (s) => s.statistics.flags.festivalHeld === true },
    ],
    reward: { educationFund: 900000, reputation: 1500, influence: 400, intlReputation: 200 },
  },
  {
    tierIndex: 7,
    name: '世界实验标杆校认定',
    title: '写进校史的评定',
    icon: '🌏',
    examiner: '国家教育评估委员会',
    paragraphs: [
      '这一次来的是国家教育评估委员会。他们没有看材料，只提了一个要求：把十年前的校史和今年的课程表放在一起。',
      '「如果两样东西不像同一所学校，」委员说，「那才是我们想看到的。」',
    ],
    requirements: [
      { label: '在校学生 ≥ 900 人', check: (s) => totalStudents(s) >= 900 },
      { label: '学生平均学术 ≥ 80', check: (s) => overallAttributes(s).academic >= 80 },
      { label: '学校影响力 ≥ 500', check: (s) => s.resources.influence >= 500 },
      { label: '累计毕业生 ≥ 2000 人', check: (s) => s.statistics.graduates >= 2000 },
      { label: '完成过至少 1 次学园传承', check: (s) => s.legacy.prestigeCount >= 1 },
      { label: '社团等级总和 ≥ 30', check: (s) => totalClubLevels(s) >= 30 },
    ],
    reward: { educationFund: 3000000, reputation: 4000, influence: 1000 },
  },
]

export const RATING_EXAM_MAP: Record<number, RatingExamDef> = RATING_EXAMS.reduce(
  (acc, exam) => {
    acc[exam.tierIndex] = exam
    return acc
  },
  {} as Record<number, RatingExamDef>,
)

export function ratingTierOf(rating: number): RatingTier {
  let current = RATING_TIERS[0]
  for (const tier of RATING_TIERS) {
    if (rating + 0.001 >= tier.min) current = tier
  }
  return current
}

/** 已通过等级决定了评级的显示上限：没过考核就上不去 */
export function ratingCapFor(tierIndex: number): number {
  const next = RATING_TIERS[Math.min(RATING_TIERS.length - 1, tierIndex + 1)]
  if (!next || next.index === tierIndex) return 100
  return next.min - 0.1
}

export function examRewardText(exam: RatingExamDef): string {
  return Object.entries(exam.reward)
    .map(([key, value]) => `${key} +${Math.round(Number(value))}`)
    .join('、')
}

export type { ResourceKey }
