import type { Season } from '../game/types'

export interface SeasonDef {
  key: Season
  name: string
  icon: string
  months: number[]
  focus: string[]
  effects: string[]
  modifiers: { target: string; op: 'add' | 'mul'; value: number }[]
}

/** 季节不只是颜色：每个季节都有明确的教学重点与全局修正。 */
export const SEASON_DEFS: SeasonDef[] = [
  {
    key: 'spring',
    name: '春季',
    icon: '🌸',
    months: [3, 4, 5],
    focus: ['招生活动', '新生入学', '社团招新', '校园建设', '新课程规划'],
    effects: ['招生相关的课程与事件效果提升', '学生满意度自然回升', '建设类事件更容易出现'],
    modifiers: [
      { target: 'enrollment', op: 'mul', value: 0.15 },
      { target: 'satisfaction_rate', op: 'mul', value: 0.1 },
      { target: 'build_speed', op: 'mul', value: 0.05 },
    ],
  },
  {
    key: 'summer',
    name: '夏季',
    icon: '☀️',
    months: [6, 7, 8],
    focus: ['体育', '社团活动', '夏令营', '校外活动', '暑期课程'],
    effects: ['体育类课程与产出提升', '竞赛与交流机会增加', '特殊事件概率提高'],
    modifiers: [
      { target: 'sports_rate', op: 'mul', value: 0.2 },
      { target: 'competition_success', op: 'mul', value: 0.04 },
      { target: 'event_interval', op: 'mul', value: -0.1 },
    ],
  },
  {
    key: 'autumn',
    name: '秋季',
    icon: '🍂',
    months: [9, 10, 11],
    focus: ['学术竞赛', '科研', '文化活动', '学校评价'],
    effects: ['科研点与文化点产出提升', '学术类比赛奖励提高', '学年评价的关键期'],
    modifiers: [
      { target: 'research_rate', op: 'mul', value: 0.15 },
      { target: 'culture_rate', op: 'mul', value: 0.15 },
      { target: 'competition_reward', op: 'mul', value: 0.06 },
    ],
  },
  {
    key: 'winter',
    name: '冬季',
    icon: '❄️',
    months: [12, 1, 2],
    focus: ['期末考试', '年度总结', '校内评价', '奖学金', '年度排名'],
    effects: ['考试成绩加成，压力快速累积', '资金与教学资源产出下降', '学年结算前的冲刺期'],
    modifiers: [
      { target: 'exam_score', op: 'mul', value: 0.1 },
      { target: 'money_rate', op: 'mul', value: -0.08 },
      { target: 'student_stress', op: 'mul', value: 0.15 },
    ],
  },
]

export const SEASON_MAP: Record<Season, SeasonDef> = SEASON_DEFS.reduce(
  (acc, def) => {
    acc[def.key] = def
    return acc
  },
  {} as Record<Season, SeasonDef>,
)
