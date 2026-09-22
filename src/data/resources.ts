import type { ResourceKey, ResourceMeta } from '../game/types'

export const RESOURCE_DEFS: ResourceMeta[] = [
  { key: 'money', name: '资金', icon: '💰', tier: '基础', desc: '学园的现金。来自学费、食堂与教育基金，用于建造、招聘与活动。' },
  { key: 'teaching', name: '教学资源', icon: '📚', tier: '基础', desc: '课程与教研资料。开课会持续消耗它，教学楼与图书馆负责产出。' },
  { key: 'reputation', name: '学校声望', icon: '⭐', tier: '基础', desc: '社会对学园的评价，直接影响招生人数、评级与上级拨款。' },
  { key: 'research', name: '科研点', icon: '🔬', tier: '中期', desc: '国家级实验项目与实验室的成果。用于研究科研类科技与高级设施。' },
  { key: 'sports', name: '体育点', icon: '🏅', tier: '中期', desc: '体能与运动成果。用于体育类活动、场馆建设与体育比赛加成。' },
  { key: 'culture', name: '文化点', icon: '🎭', tier: '中期', desc: '艺术与人文积累。用于文化活动与艺术类课程解锁。' },
  { key: 'activity', name: '学生活跃度', icon: '🎈', tier: '中期', desc: '社团与学生自治的活跃程度，影响事件走向与比赛表现。主要由中庭广场、社团活动楼、部室栋、学生活动中心产出，成立与升级社团都要花它。' },
  { key: 'parentTrust', name: '家长认可度', icon: '🤝', tier: '中期', desc: '家长委员会的评价，影响招生与突发事件的容错。' },
  { key: 'alumniContribution', name: '校友贡献', icon: '🎓', tier: '后期', desc: '毕业校友带来的捐赠、设备与机会。毕业时结算。' },
  { key: 'educationFund', name: '教育基金', icon: '🏦', tier: '后期', desc: '年度结算时由上级部门拨付的教育基金，可用于高等级建造。' },
  { key: 'intlReputation', name: '国际声誉', icon: '🌐', tier: '后期', desc: '国际交流与实验项目带来的声誉，解锁国际活动。' },
  { key: 'influence', name: '学校影响力', icon: '📡', tier: '后期', desc: '学园对区域教育体系的影响，影响传承收益与顶级设施。' },
]

export const BASIC_RESOURCES: ResourceKey[] = ['money', 'teaching', 'reputation']
export const MID_RESOURCES: ResourceKey[] = ['research', 'sports', 'culture', 'activity', 'parentTrust']
export const LATE_RESOURCES: ResourceKey[] = ['alumniContribution', 'educationFund', 'intlReputation', 'influence']
export const ALL_RESOURCES: ResourceKey[] = [...BASIC_RESOURCES, ...MID_RESOURCES, ...LATE_RESOURCES]

export const RESOURCE_MAP: Record<ResourceKey, ResourceMeta> = RESOURCE_DEFS.reduce(
  (acc, def) => {
    acc[def.key] = def
    return acc
  },
  {} as Record<ResourceKey, ResourceMeta>,
)
