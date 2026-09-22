import type { EventDef } from '../game/types'
import { combo, gain, setFlag, studentDelta, teacherDelta, text } from './eventHelpers'

/**
 * 随机事件池。
 * 事件不只是加减资源：每个事件都有背景、选择与后续影响，
 * 部分事件支持延迟结算（例如教师科研项目会在数日后进入新的阶段）。
 */
export const EVENT_DEFS: EventDef[] = [
  /* ---------------------- 剧情事件（weight 0：不进随机池） ---------------------- */
  {
    id: 'tutorialErrand',
    title: '开学第一周',
    icon: '📋',
    text: '教务处桌上堆着一叠没批完的单子：食堂想换一批灶具、图书馆要补两百册书、体育组申请把旧器材报废。老教师站在门口，等你先签哪一张。',
    category: '校园',
    // weight 0 = 永远不会被随机刷出来，只由剧情引导派发
    weight: 0,
    choices: [
      {
        label: '先修食堂的灶具',
        hint: '花掉 600 资金，学生满意度与健康上升',
        cost: { money: 600 },
        studentDelta: { satisfaction: 5, health: 2 },
        notes: ['第一周就吃上了热饭，食堂的意见簿安静了很多。'],
      },
      {
        label: '先补图书馆的书',
        hint: '花掉 600 资金，拿到一批教学资源，学术成长更快',
        cost: { money: 600 },
        gain: { teaching: 200 },
        studentDelta: { academic: 1.5 },
        notes: ['新书进了馆，晚自习的人多了起来。'],
      },
    ],
  },
  /* ------------------------------ 校园 ------------------------------ */
  {
    id: 'clubConflict',
    title: '学生社团冲突',
    icon: '🎪',
    text: '动漫社与辩论社因为活动室使用时间吵到了校长室门口。两个社长都带着二十多个学生站在走廊里，谁也不肯先走。',
    category: '校园',
    weight: 10,
    cooldownDays: 20,
    choices: [
      {
        label: '支持学生自治，让他们自己谈',
        hint: '满意度与社交能力提升，可能催生新的社团',
        apply: combo(
          studentDelta({ satisfaction: 6, social: 3 }, '学生自治委员会第一次真正行使了权力。'),
          gain({ activity: 40 }),
          setFlag('studentSelfRule_ok'),
        ),
      },
      {
        label: '由我裁定，活动室按年级分配',
        hint: '纪律与执行效率提升，部分学生不满',
        apply: combo(
          studentDelta({ satisfaction: -4, morality: 1 }, '学校把矛盾压了下去，走廊恢复了安静。'),
          gain({ teaching: 120, parentTrust: 8 }),
        ),
      },
    ],
  },
  {
    id: 'canteenComplaint',
    title: '食堂投诉',
    icon: '🍚',
    text: '家长委员会递来一份联名信：有学生反映最近两周的食堂菜品重复率过高，还有人说汤是温的。',
    category: '校园',
    weight: 9,
    cooldownDays: 15,
    choices: [
      {
        label: '追加预算整改后厨',
        hint: '花掉一笔钱，换回满意度与家长认可',
        apply: combo(
          gain({ money: -1200, parentTrust: 15 }, '后厨换了新设备，菜单每周轮换。'),
          studentDelta({ satisfaction: 7, health: 2 }),
        ),
      },
      {
        label: '把食堂外包给市餐饮集团',
        hint: '省钱且收入更高，但口味由别人决定',
        apply: combo(
          gain({ money: 600, parentTrust: -6 }),
          studentDelta({ satisfaction: -3 }),
          text('承包商入场，成本大幅下降，学生开始在群里点外卖。'),
        ),
      },
    ],
  },
  {
    id: 'powerOutage',
    title: '深夜停电',
    icon: '🔌',
    text: '晚上十点，整个教学区突然断电。值周教师发现变压器的负载早已超过设计上限，这一片线路还是三十年前的。',
    category: '校园',
    weight: 8,
    cooldownDays: 25,
    choices: [
      {
        label: '全电路改造，一次性投入',
        hint: '高额支出，长期提升建造效率',
        effects: [{ target: 'build_speed', op: 'mul', value: 0.05 }],
        apply: combo(
          gain({ money: -2500 }, '新的配电系统上线，施工队说以后扩建会快很多。'),
          text('获得永久加成：建造速度 +5%'),
        ),
      },
      {
        label: '先修好能用的部分',
        hint: '省钱，但学生要在自习室点蜡烛',
        apply: combo(
          gain({ money: -300 }),
          studentDelta({ satisfaction: -5, stress: 4 }),
          text('供电恢复了，但每到用电高峰还是会闪两下。'),
        ),
      },
    ],
  },
  {
    id: 'strayCat',
    title: '校园里的流浪猫',
    icon: '🐈',
    text: '一只三花猫在食堂后面生了一窝小猫。学生自发排班喂食，还有人给它起了名字。',
    category: '校园',
    weight: 10,
    cooldownDays: 30,
    choices: [
      {
        label: '正式收编为校园猫',
        hint: '满意度与活跃度提升',
        apply: combo(
          studentDelta({ satisfaction: 5, stress: -3 }, '第一只「校猫」有了自己的校园卡。'),
          gain({ activity: 25 }),
        ),
      },
      {
        label: '联系动物救助站送走',
        hint: '避免卫生风险，学生有点失落',
        apply: combo(
          gain({ parentTrust: 8, money: -200 }),
          studentDelta({ satisfaction: -3 }),
        ),
      },
    ],
  },
  {
    id: 'dormNight',
    title: '宿舍夜谈',
    icon: '🌙',
    text: '宿管老师凌晨一点查寝，发现高二（3）班整个宿舍的人都在聊天。学生说他们在讨论白天的课题，不肯承认是闲聊。',
    category: '校园',
    weight: 9,
    cooldownDays: 12,
    choices: [
      {
        label: '改成「夜间学术自由时间」',
        hint: '成长与社交提升，但需要教师值守',
        apply: combo(
          studentDelta({ academic: 1.2, social: 1.5, stress: -2 }, '这次谈话被写进了学园制度手册。'),
          gain({ teaching: -150 }),
        ),
      },
      {
        label: '严格执行熄灯制度',
        hint: '纪律与压力双升',
        apply: combo(
          studentDelta({ stress: 5, satisfaction: -3 }, '第二天全宿舍都顶着黑眼圈上课。'),
          gain({ parentTrust: 5 }),
        ),
      },
    ],
  },
  {
    id: 'graffiti',
    title: '涂鸦事件',
    icon: '🎨',
    text: '艺术楼外墙被画上了一整面壁画：一群学生站在星空下，标题写着「我们这一代」。没人承认是谁画的。',
    category: '校园',
    weight: 8,
    cooldownDays: 30,
    choices: [
      {
        label: '保留它，并署名「匿名校友」',
        hint: '文化点与满意度大幅提升',
        apply: combo(
          gain({ culture: 120, reputation: 15 }, '这面墙后来成了学园的宣传照背景。'),
          studentDelta({ satisfaction: 6, creativity: 2 }),
        ),
      },
      {
        label: '清理干净，重新粉刷',
        hint: '维护校规，但创造力受挫',
        apply: combo(
          gain({ money: -150, parentTrust: 5 }),
          studentDelta({ creativity: -1, satisfaction: -4 }),
        ),
      },
    ],
  },
  {
    id: 'anonymousLetter',
    title: '匿名举报信',
    icon: '✉️',
    text: '校长室门口被塞了一封信：某位教师在课上长期占用学生的自由时间补课，署名只有一句「一个不敢说名字的学生」。',
    category: '校园',
    weight: 8,
    cooldownDays: 20,
    choices: [
      {
        label: '公开调查并保护举报人',
        hint: '学生信任提升，教师压力上升',
        apply: combo(
          gain({ parentTrust: 10 }),
          studentDelta({ satisfaction: 5, stress: -2 }, '调查流程被写进学园章程。'),
          teacherDelta({ stress: 6, morale: -3 }),
        ),
      },
      {
        label: '私下提醒那位教师',
        hint: '风波平息，教师士气稳定',
        apply: combo(
          teacherDelta({ morale: 5 }),
          studentDelta({ satisfaction: -2 }),
          text('补课停了，但那封信的事再没人提过。'),
        ),
      },
    ],
  },
  {
    id: 'brokenHeater',
    title: '冬天没有暖气',
    icon: '🥶',
    text: '入冬第一周，宿舍楼的热水系统集体罢工。学生们裹着被子在走廊里排队打水。',
    category: '校园',
    weight: 9,
    seasons: ['winter'],
    cooldownDays: 20,
    choices: [
      {
        label: '连夜抢修，全部由学校承担',
        hint: '花掉资金，换回健康与满意度',
        apply: combo(
          gain({ money: -1500 }),
          studentDelta({ health: 3, satisfaction: 6 }, '凌晨三点，第一股热水重新流了出来。'),
        ),
      },
      {
        label: '开放体育馆更衣室应急',
        hint: '低成本周转，但学生压力上升',
        apply: combo(
          studentDelta({ stress: 5, satisfaction: -5, health: -2 }),
          gain({ money: -200 }),
        ),
      },
    ],
  },
  /* ------------------------------ 学生 ------------------------------ */
  {
    id: 'studentLow',
    title: '学生的低谷',
    icon: '🌧️',
    text: '高二一位成绩很好的学生连续两周缺课。心理教师说，他每天在宿舍躺着，只说了一句「我不知道努力有什么用」。',
    category: '学生',
    weight: 10,
    cooldownDays: 18,
    choices: [
      {
        label: '安排一对一辅导与长期陪伴',
        hint: '花钱花时间，换回一个学生',
        apply: combo(
          gain({ money: -400, teaching: -200 }),
          studentDelta({ stress: -8, satisfaction: 5, health: 3 }, '他回来了，还带去参加了城市科研赛。'),
        ),
      },
      {
        label: '暂时休学，让他回家调整',
        hint: '学校止损，但会失去一名学生',
        apply: combo(
          studentDelta({ satisfaction: -3 }, '学籍保留，但他在毕业名单上留了个空位。'),
          gain({ parentTrust: -5 }),
        ),
      },
    ],
  },
  {
    id: 'studentInvention',
    title: '学生的发明',
    icon: '🔧',
    text: '一名高一学生在创客实验室做出了一台自动批改作文雏形机。他说自己只是「懒得抄评语」。',
    category: '学生',
    weight: 9,
    cooldownDays: 25,
    requires: { buildings: { infoCenter: 1 } },
    choices: [
      {
        label: '拨经费支持他继续做',
        hint: '科研点与创造力大幅提升',
        apply: combo(
          gain({ money: -800, research: 200, reputation: 12 }, '学园第一次以学生名义申请了市级课题。'),
          studentDelta({ creativity: 3, research: 2 }),
        ),
      },
      {
        label: '鼓励他把想法写成论文',
        hint: '稳健的学术收益',
        apply: combo(
          gain({ research: 80, parentTrust: 8 }),
          studentDelta({ academic: 1.5, research: 1 }),
        ),
      },
    ],
  },
  {
    id: 'cheatingRing',
    title: '考场里的答案',
    icon: '📵',
    text: '月考结束后，教务处在三个考场发现了同一份「标准答案」的传播链，涉及十几名学生。',
    category: '学生',
    weight: 8,
    cooldownDays: 22,
    choices: [
      {
        label: '全部重新考试并公开说明',
        hint: '公平优先，压力上升',
        apply: combo(
          studentDelta({ stress: 6, morality: 2 }, '重考那天，教室里安静得能听见钟声。'),
          gain({ parentTrust: 12, teaching: -200 }),
        ),
      },
      {
        label: '只处理组织者，其余人自主申报',
        hint: '宽容处理，满意度高但风险仍在',
        apply: combo(
          studentDelta({ satisfaction: 5, morality: -1 }),
          gain({ parentTrust: -8 }),
          text('有 9 名学生主动申报，学园保住了他们的信任。'),
        ),
      },
    ],
  },
  {
    id: 'skippingClass',
    title: '翻墙出去的学生',
    icon: '🧱',
    text: '门卫在校墙外的网吧找到三名高二学生。他们翻墙只是为了去看一场城市篮球决赛的直播。',
    category: '学生',
    weight: 8,
    cooldownDays: 15,
    choices: [
      {
        label: '在礼堂开放公共直播',
        hint: '满意度与大礼堂利用率提升',
        apply: combo(
          studentDelta({ satisfaction: 6, sports: 0.8 }, '下一次比赛，全校在大礼堂一起看。'),
          gain({ activity: 30, culture: 20 }),
        ),
      },
      {
        label: '全校通报并加强门禁',
        hint: '压力与家长认可上升',
        apply: combo(
          studentDelta({ stress: 4, satisfaction: -4 }),
          gain({ parentTrust: 10 }),
        ),
      },
    ],
  },
  {
    id: 'debateSelfHost',
    title: '学生要自己办辩论赛',
    icon: '⚖️',
    text: '辩论社递上一份完整策划案：他们想邀请八所学校来学园参赛，预算只写了「全靠拉赞助」。',
    category: '学生',
    weight: 8,
    cooldownDays: 25,
    requires: { tech: ['clubSystem'] },
    choices: [
      {
        label: '批预算，让他们自己办',
        hint: '花钱，换取声望与社交成长',
        apply: combo(
          gain({ money: -1000, reputation: 20, activity: 60 }, '八所学校来了七所，决赛在礼堂打到晚上十点。'),
          studentDelta({ social: 3, satisfaction: 5 }),
        ),
      },
      {
        label: '只提供场地，其余自理',
        hint: '低成本，收益也小',
        apply: combo(
          gain({ activity: 25, culture: 30 }),
          studentDelta({ social: 1.5 }),
        ),
      },
    ],
  },
  {
    id: 'scholarshipApply',
    title: '奖学金申请',
    icon: '🏅',
    text: '上级部门下拨了一笔专项奖学金，但只够发给三名学生。教委会为了名单已经开了两次会。',
    category: '学生',
    weight: 8,
    cooldownDays: 30,
    choices: [
      {
        label: '按学业成绩评定',
        hint: '学术导向，普通学生略有不满',
        apply: combo(
          gain({ educationFund: 1200, research: 60 }),
          studentDelta({ academic: 1.5, satisfaction: -2 }),
        ),
      },
      {
        label: '按成长幅度评定',
        hint: '带动所有人努力',
        apply: combo(
          gain({ educationFund: 1200 }),
          studentDelta({ satisfaction: 5, stress: -2 }, '进步最大的那个学生当场哭了。'),
        ),
      },
    ],
  },
  /* ------------------------------ 教师 ------------------------------ */
  {
    id: 'teacherResearch',
    title: '教师提交科研项目',
    icon: '🔬',
    text: '理化组的三位教师提交了一份市级课题申请。他们需要一笔启动资金，也需要占用教学时间。',
    category: '教师',
    weight: 10,
    cooldownDays: 25,
    choices: [
      {
        label: '全额支持，给他们时间',
        hint: '投入资金，项目将在数日后进入下一阶段',
        apply: combo(
          gain({ money: -1500, teaching: -300 }, '课题正式立项，三位教师停掉了两成课时。'),
          setFlag('researchProjectFunded'),
        ),
        schedule: [{ eventId: 'researchProjectProgress', days: 2 }],
      },
      {
        label: '只给少量经费，不能停课',
        hint: '保守做法，收益有限',
        apply: combo(
          gain({ money: -300, research: 60 }),
          teacherDelta({ stress: 4 }),
        ),
        schedule: [{ eventId: 'researchProjectProgress', days: 2 }],
      },
      {
        label: '婉拒，教学优先',
        hint: '教师士气下降',
        apply: combo(
          teacherDelta({ morale: -6 }),
          text('三份申请书被放回了抽屉里。'),
        ),
      },
    ],
  },
  {
    id: 'researchProjectProgress',
    title: '课题进入关键期',
    icon: '🧪',
    text: '课题进入了数据整理阶段。教师组报告说，设备精度不够，要么追加投入，要么接受一个普通结果。',
    category: '教师',
    weight: 0,
    cooldownDays: 5,
    choices: [
      {
        label: '追加设备投入',
        hint: '高投入高回报',
        apply: combo(
          gain({ money: -3000, research: 900, reputation: 15 }, '数据终于收敛，论文投出去了。'),
          teacherDelta({ quality: 3, morale: 5 }),
          setFlag('researchProjectGreat'),
        ),
      },
      {
        label: '维持原计划收尾',
        hint: '稳健结果',
        apply: combo(
          gain({ research: 300, reputation: 5 }, '课题按时结题，水平中规中矩。'),
          teacherDelta({ quality: 1 }),
        ),
      },
      {
        label: '终止项目，回收经费',
        hint: '止损，士气受损',
        apply: combo(
          gain({ money: 500 }),
          teacherDelta({ morale: -8, stress: -5 }),
          text('三位教师没有再提交过课题申请。'),
        ),
      },
    ],
  },
  {
    id: 'teacherPoached',
    title: '教师被挖角',
    icon: '📞',
    text: '邻市一所新建实验校给数学组组长开出了双倍薪资，还承诺解决住房。他还没有给答复。',
    category: '教师',
    weight: 9,
    cooldownDays: 30,
    choices: [
      {
        label: '加薪留人，并给教研组更多资源',
        hint: '花资金保教师',
        apply: combo(
          gain({ money: -4000 }, '他的薪资涨了，数学组拿到了新的教研预算。'),
          teacherDelta({ morale: 10, quality: 2 }),
        ),
      },
      {
        label: '尊重他的选择',
        hint: '节省资金，但师资受损',
        apply: combo(
          teacherDelta({ morale: -8 }),
          text('他走的那天，数学组少了一个人，也少了很多话。'),
        ),
      },
    ],
  },
  {
    id: 'teacherBurnout',
    title: '教师过劳',
    icon: '😵',
    text: '教务处发现语文组一位教师连续三周每天工作到十一点。她说「没事，学生要考试」。',
    category: '教师',
    weight: 9,
    cooldownDays: 20,
    choices: [
      {
        label: '强制休假并聘请代课教师',
        hint: '花钱减压',
        apply: combo(
          gain({ money: -1200, teaching: -100 }),
          teacherDelta({ stress: -15, morale: 8 }),
        ),
      },
      {
        label: '调整排课，减少她的班次',
        hint: '温和处理',
        apply: combo(
          teacherDelta({ stress: -6 }),
          gain({ teaching: -200 }),
        ),
      },
    ],
  },
  {
    id: 'starTeacherApply',
    title: '特级教师应聘',
    icon: '🧑‍🏫',
    text: '一位市级认定的特级教师投来了简历，要求带一个自己的教研组，并且要两个班的自主排课权。',
    category: '教师',
    weight: 7,
    cooldownDays: 40,
    minSchoolYear: 2,
    choices: [
      {
        label: '接受全部条件',
        hint: '大幅提升教师能力，成本很高',
        apply: combo(
          gain({ money: -8000, teaching: -500 }),
          teacherDelta({ quality: 5, morale: 5, stress: 3 }),
          text('她到任第一天就把教研室的灯点到了十一点。'),
        ),
        effects: [{ target: 'teacher_efficiency', op: 'mul', value: 0.03 }],
      },
      {
        label: '只接受常规聘用',
        hint: '成本低，影响有限',
        apply: combo(
          gain({ money: -2000 }),
          teacherDelta({ quality: 1.5, stress: -2 }),
        ),
      },
    ],
  },
  {
    id: 'teachingDispute',
    title: '教研组的争执',
    icon: '🗯️',
    text: '数学组内部为「是否在高一引入竞赛难度内容」吵了两次会。两位骨干教师互不让步。',
    category: '教师',
    weight: 8,
    cooldownDays: 18,
    choices: [
      {
        label: '让他们各带一个班做对照实验',
        hint: '科研点与教学经验提升',
        apply: combo(
          gain({ research: 120, teaching: 60 }, '半年后数据出来了，两派都改了主意。'),
          teacherDelta({ quality: 2, stress: 3 }),
        ),
      },
      {
        label: '由教务处统一决定',
        hint: '效率优先',
        apply: combo(
          teacherDelta({ morale: -4 }),
          gain({ teaching: 100 }),
        ),
      },
    ],
  },
  /* ------------------------------ 比赛 ------------------------------ */
  {
    id: 'leagueInvite',
    title: '兄弟学校邀请联赛',
    icon: '🏟️',
    text: '邻区三所高中联合发来邀请，希望学园参加下个月的校际联赛。赛程很紧，会占用大量课时。',
    category: '比赛',
    weight: 11,
    cooldownDays: 20,
    choices: [
      {
        label: '接受邀请，派最强阵容',
        hint: '高回报高风险',
        apply: combo(
          gain({ teaching: -300, sports: 40, reputation: 18 }, '队伍出发那天，全校在门口送行。'),
          studentDelta({ sports: 1.5, stress: 4, satisfaction: 3 }),
        ),
      },
      {
        label: '婉拒，专注课程',
        hint: '保稳定',
        apply: combo(
          gain({ teaching: 200, parentTrust: 5 }),
          studentDelta({ satisfaction: -3, stress: -2 }),
        ),
      },
    ],
  },
  {
    id: 'refereeDispute',
    title: '判罚争议',
    icon: '🟨',
    text: '决赛最后两分钟，裁判的一次判罚直接改变了比分。我们的队员围住了裁判，观众席上开始有人喊话。',
    category: '比赛',
    weight: 8,
    cooldownDays: 25,
    requires: { tech: ['regionalLeague'] },
    choices: [
      {
        label: '让队员立刻离场，赛后正式申诉',
        hint: '体面但可能失去比分',
        apply: combo(
          gain({ reputation: 15, parentTrust: 12 }, '学园的公开发言被区域媒体转发。'),
          studentDelta({ morality: 1.5, stress: 2 }),
        ),
      },
      {
        label: '据理力争，坚持到底',
        hint: '可能改判，也可能被处罚',
        apply: combo(
          gain({ reputation: 6, sports: 25 }),
          studentDelta({ stress: 6, sports: 1 }, '比赛重赛了半节，我们赢了两分。'),
        ),
      },
    ],
  },
  {
    id: 'injuredPlayer',
    title: '队员受伤',
    icon: '🩹',
    text: '训练中，校队主力在一次落地时扭伤了脚踝。医生说至少需要六周恢复。',
    category: '比赛',
    weight: 9,
    cooldownDays: 20,
    choices: [
      {
        label: '请最好的运动医学团队',
        hint: '花钱换回健康',
        apply: combo(
          gain({ money: -1800 }),
          studentDelta({ health: 2 }, '康复计划被做成了学园标准流程。'),
          setFlag('sportsMedical'),
        ),
      },
      {
        label: '常规治疗，让她自己恢复',
        hint: '省钱，但可能影响状态',
        apply: combo(
          studentDelta({ health: -2, stress: 3, sports: -1 }, '她错过了整个赛季的前半段。'),
        ),
      },
    ],
  },
  /* ------------------------------ 季节 ------------------------------ */
  {
    id: 'springOpenDay',
    title: '春季开放日',
    icon: '🌸',
    text: '春天来了，教育局要求各校举办开放日。校门外的家长比往年多了将近一倍。',
    category: '季节',
    weight: 14,
    seasons: ['spring'],
    cooldownDays: 20,
    choices: [
      {
        label: '全力办一场展示活动',
        hint: '招生加成与声望提升',
        apply: combo(
          gain({ money: -600, reputation: 25, parentTrust: 20 }, '开放日当天，报名咨询台排到了校门口。'),
        ),
      },
      {
        label: '小规模接待，保证正常上课',
        hint: '低成本',
        apply: combo(
          gain({ reputation: 8, parentTrust: 6 }),
        ),
      },
    ],
  },
  {
    id: 'summerHeat',
    title: '酷暑',
    icon: '🌡️',
    text: '连续一周气温超过三十八度，教室里风扇转得像要飞出去。有学生在体育课上晕倒了。',
    category: '季节',
    weight: 13,
    seasons: ['summer'],
    cooldownDays: 18,
    choices: [
      {
        label: '调整作息，避开正午并开放空调教室',
        hint: '电费换健康',
        apply: combo(
          gain({ money: -900 }),
          studentDelta({ health: 3, stress: -3, satisfaction: 5 }),
        ),
      },
      {
        label: '维持原课表，发放防暑物资',
        hint: '省钱但学生状态下滑',
        apply: combo(
          gain({ money: -200 }),
          studentDelta({ health: -3, stress: 5, satisfaction: -4 }),
        ),
      },
    ],
  },
  {
    id: 'autumnSportsMeet',
    title: '秋季运动会',
    icon: '🍂',
    text: '秋季是学园的传统运动会季。学生自治委员会今年提出了一个新方案：把运动会办成跨学科项目。',
    category: '季节',
    weight: 14,
    seasons: ['autumn'],
    cooldownDays: 20,
    choices: [
      {
        label: '批准跨学科方案',
        hint: '体育、科研与创造力同时提升',
        apply: combo(
          gain({ money: -800, sports: 80, research: 100, culture: 60 }, '运动会数据被物理组拿去做了课题。'),
          studentDelta({ sports: 2, research: 1, satisfaction: 6 }),
        ),
      },
      {
        label: '按传统方案办',
        hint: '稳定收益，成本低',
        apply: combo(
          gain({ sports: 50, activity: 40, parentTrust: 8 }),
          studentDelta({ sports: 1, satisfaction: 3 }),
        ),
      },
    ],
  },
  {
    id: 'winterExamWeek',
    title: '冬季考试周',
    icon: '❄️',
    text: '期末考临近，教学楼在晚上十点依旧灯火通明。心理教师提醒：压力指数已经接近警戒线。',
    category: '季节',
    weight: 14,
    seasons: ['winter'],
    cooldownDays: 15,
    choices: [
      {
        label: '开设考前减压专场',
        hint: '低压力路线',
        apply: combo(
          gain({ teaching: -150 }),
          studentDelta({ stress: -8, satisfaction: 6 }),
        ),
      },
      {
        label: '延长自习时间，全力冲刺',
        hint: '成绩优先',
        apply: combo(
          gain({ parentTrust: 15, teaching: 100 }, '考试成绩单比往年漂亮。'),
          studentDelta({ academic: 2, stress: 10, satisfaction: -6 }),
        ),
      },
    ],
  },
  {
    id: 'springStorm',
    title: '春季暴雨',
    icon: '⛈️',
    text: '连续暴雨让操场积了半米深的水，体育馆屋顶开始渗漏。应急管理部门打来了电话。',
    category: '季节',
    weight: 11,
    seasons: ['spring'],
    cooldownDays: 25,
    choices: [
      {
        label: '全面检修并加固建筑',
        hint: '高投入，长期收益',
        effects: [{ target: 'build_cost', op: 'mul', value: -0.03 }],
        apply: combo(
          gain({ money: -3500 }, '检修报告显示，学园建筑安全等级提升了一档。'),
        ),
      },
      {
        label: '临时排水，撑过雨季',
        hint: '便宜，但体育课程受阻',
        apply: combo(
          gain({ money: -400 }),
          studentDelta({ satisfaction: -3, sports: -1 }),
        ),
      },
    ],
  },
  {
    id: 'summerCampInvite',
    title: '夏令营邀请',
    icon: '⛺',
    text: '一所沿海实验校邀请学园参加为期两周的夏季科研营地，名额只有二十个。',
    category: '季节',
    weight: 12,
    seasons: ['summer'],
    cooldownDays: 30,
    minSchoolYear: 2,
    choices: [
      {
        label: '派出最好的二十人',
        hint: '科研与社交提升，成本较高',
        apply: combo(
          gain({ money: -1500, research: 250, intlReputation: 20 }, '他们带回来的不仅是数据，还有一堆约定。'),
          studentDelta({ research: 2, social: 1.5 }),
        ),
      },
      {
        label: '不参加，留在学校做课题',
        hint: '节省资金',
        apply: combo(
          gain({ research: 80 }),
          studentDelta({ research: 0.5 }),
        ),
      },
    ],
  },
  /* ------------------------------ 校友 ------------------------------ */
  {
    id: 'alumniSpeech',
    title: '知名校友回校演讲',
    icon: '🎤',
    text: '一位毕业十年的校友回信说想回校看看。他现在是一家教育研究机构的研究员，当年的班主任还记得他。',
    category: '校友',
    weight: 10,
    cooldownDays: 25,
    requires: { graduates: 30 },
    choices: [
      {
        label: '安排全校演讲并设问答',
        hint: '声望与学生成长提升',
        apply: combo(
          gain({ reputation: 30, alumniContribution: 60, culture: 40 }, '那天礼堂坐满了，连过道都站着人。'),
          studentDelta({ morality: 1.5, academic: 1, satisfaction: 5 }),
          setFlag('alumniReturned'),
        ),
      },
      {
        label: '只安排小范围座谈',
        hint: '低调处理',
        apply: combo(
          gain({ reputation: 10, alumniContribution: 20 }),
          studentDelta({ academic: 0.5 }),
        ),
      },
    ],
  },
  {
    id: 'alumniDonation',
    title: '校友捐赠设备',
    icon: '🎁',
    text: '一位校友把公司淘汰的一批图形工作站捐给了学校，条件是希望学园开设一门真正的设计课程。',
    category: '校友',
    weight: 9,
    cooldownDays: 30,
    requires: { buildings: { alumniCenter: 1 } },
    choices: [
      {
        label: '接受设备并开设新课程',
        hint: '长期课程收益',
        effects: [{ target: 'course_efficiency', op: 'mul', value: 0.02 }],
        apply: combo(
          gain({ money: 2000, research: 200, culture: 80 }, '四十台工作站进了信息中心，设计课排上了课表。'),
        ),
      },
      {
        label: '接受设备，折现投入基建',
        hint: '一次性资金',
        apply: combo(
          gain({ money: 6000 }, '设备被转卖，钱进了基建账。'),
        ),
      },
    ],
  },
  {
    id: 'alumniJobFair',
    title: '校友招聘会',
    icon: '💼',
    text: '几位校友希望回校招募实习生。他们说，想看看「自己当年那个位置现在坐着谁」。',
    category: '校友',
    weight: 8,
    cooldownDays: 40,
    requires: { graduates: 80 },
    choices: [
      {
        label: '联合举办升学与就业咨询会',
        hint: '校友贡献与家长认可大幅提升',
        apply: combo(
          gain({ alumniContribution: 150, parentTrust: 25, money: 1500 }, '高三学生第一次知道自己的专业能做什么。'),
          studentDelta({ satisfaction: 6, social: 1 }),
        ),
      },
      {
        label: '仅提供场地',
        hint: '保守收益',
        apply: combo(
          gain({ alumniContribution: 40 }),
        ),
      },
    ],
  },
  /* ------------------------------ 外校与特殊 ------------------------------ */
  {
    id: 'sisterSchoolHelp',
    title: '兄弟学校的求助',
    icon: '📨',
    text: '邻市一所实验校发来请求：他们的物理实验室刚被鉴定为危房，想借我们的实验楼上一个月的课。',
    category: '外校',
    weight: 9,
    cooldownDays: 30,
    requires: { buildings: { labBuilding: 1 } },
    choices: [
      {
        label: '开放实验楼，费用全免',
        hint: '声望大升，教学资源被占用',
        apply: combo(
          gain({ teaching: -400, reputation: 40, intlReputation: 10 }, '一个月后，他们送来了一面手写的锦旗。'),
        ),
      },
      {
        label: '按成本收取使用费',
        hint: '收支平衡',
        apply: combo(
          gain({ money: 1200, reputation: 12 }),
        ),
      },
      {
        label: '婉拒，本校课程也很紧',
        hint: '保教学，声望受损',
        apply: combo(
          gain({ reputation: -10 }),
          text('邮件回复得很客气，之后再没有收到过邀请。'),
        ),
      },
    ],
  },
  {
    id: 'cityInspection',
    title: '城市督导检查',
    icon: '📋',
    text: '教育局督导组临时通知：明天上午到校检查办学规范与学生状态。',
    category: '外校',
    weight: 11,
    cooldownDays: 25,
    choices: [
      {
        label: '停课一天准备迎检材料',
        hint: '检查通过率高，课程受影响',
        apply: combo(
          gain({ teaching: -250, parentTrust: 20, reputation: 15 }, '督导组给出的评价是「规范且有序」。'),
          studentDelta({ satisfaction: -2 }),
        ),
      },
      {
        label: '照常上课，如实呈现',
        hint: '压力测试',
        apply: combo(
          gain({ reputation: 8, parentTrust: 6 }),
          studentDelta({ stress: 2 }),
          text('督导组看到了一间没准备的学校，也看到了真实的学生。'),
        ),
      },
    ],
  },
  {
    id: 'ministryInspection',
    title: '上级部门视察',
    icon: '🏛️',
    text: '教育局视察团抵达学园。他们想确认的只有一件事：这所学校是否真的对得起学生的三年。',
    category: '特殊',
    weight: 6,
    cooldownDays: 90,
    minSchoolYear: 3,
    requires: { schoolRating: 45 },
    choices: [
      {
        label: '展示完整办学成果与数据',
        hint: '声望、基金与影响力的巨大机会',
        apply: combo(
          gain({ reputation: 120, educationFund: 5000, influence: 60, intlReputation: 40 }, '视察团在报告里写下：「此校模式可复制。」'),
        ),
        effects: [{ target: 'enrollment', op: 'mul', value: 0.05 }],
      },
      {
        label: '只展示教学一线，不做汇报',
        hint: '低调但真实',
        apply: combo(
          gain({ reputation: 40, parentTrust: 30 }, '视察团在食堂和学生们一起吃了午饭。'),
        ),
      },
    ],
  },
  {
    id: 'populationReport',
    title: '区域生源调查',
    icon: '📉',
    text: '教育局发布了区域生源调查：未来十年本区初中毕业生预计减少两成。报告里提到，「学校的招生策略必须调整」。',
    category: '特殊',
    weight: 7,
    cooldownDays: 60,
    minSchoolYear: 2,
    choices: [
      {
        label: '主动转型：扩大跨区与终身教育',
        hint: '招生与容量长期提升，成本上升',
        effects: [
          { target: 'enrollment', op: 'mul', value: 0.06 },
          { target: 'student_capacity', op: 'mul', value: 0.05 },
          { target: 'salary', op: 'mul', value: 0.05 },
        ],
        apply: combo(
          gain({ money: -2000 }, '学园宣布面向全国招生，并试点「校友回归课程」。'),
        ),
      },
      {
        label: '坚持精英小规模路线',
        hint: '质量提升，规模受限',
        effects: [
          { target: 'student_growth', op: 'mul', value: 0.05 },
          { target: 'enrollment', op: 'mul', value: -0.05 },
        ],
        apply: combo(
          gain({ reputation: 20 }, '学园决定把资源集中到每一个学生身上。'),
        ),
      },
    ],
  },
  {
    id: 'mysteriousDonor',
    title: '匿名巨额捐款',
    icon: '💎',
    text: '一笔数额巨大的转账打进了学园账户，附言只有一行：「替一个没能上高中的人捐的。」',
    category: '特殊',
    weight: 4,
    cooldownDays: 120,
    minSchoolYear: 2,
    choices: [
      {
        label: '全额投入学生资助体系',
        hint: '满意度与家长认可大幅提升',
        apply: combo(
          gain({ money: 8000, parentTrust: 40 }, '学园设立了「无名助学金」。'),
          studentDelta({ satisfaction: 10, stress: -8 }),
        ),
      },
      {
        label: '投入科研与设施建设',
        hint: '长期科研收益',
        apply: combo(
          gain({ money: 8000, research: 600 }, '这笔钱变成了三间新实验室。'),
        ),
        effects: [{ target: 'research_rate', op: 'mul', value: 0.03 }],
      },
    ],
  },
  {
    id: 'aiPilot',
    title: '教学 AI 试点',
    icon: '🤖',
    text: '教育部门希望学园参与「教学智能体」试点：由 AI 承担部分作业批改与个性化出题。校务委员会对此意见分裂。',
    category: '特殊',
    weight: 7,
    cooldownDays: 60,
    requires: { tech: ['digitalCampus'] },
    choices: [
      {
        label: '全校试点，全面接入',
        hint: '课程效率大幅提升，教师压力上升',
        effects: [
          { target: 'course_efficiency', op: 'mul', value: 0.05 },
          { target: 'teacher_stress', op: 'mul', value: 0.1 },
        ],
        apply: combo(
          gain({ research: 300, teaching: 400 }, '系统上线第一周，教师的备课时长下降了三分之一。'),
        ),
      },
      {
        label: '只在两个班试点，保持人工复核',
        hint: '稳健路线',
        apply: combo(
          gain({ research: 120, teaching: 150 }),
          teacherDelta({ stress: -3 }),
        ),
      },
      {
        label: '拒绝试点，坚持人工教学',
        hint: '教师士气上升',
        apply: combo(
          teacherDelta({ morale: 10, stress: -5 }),
          gain({ culture: 60 }),
        ),
      },
    ],
  },
  {
    id: 'renovationProject',
    title: '校舍维修工程',
    icon: '🏗️',
    text: '施工队进场后发现旧教学楼的地基比图纸上标注的更深，工期和预算都要重新算。',
    category: '校园',
    weight: 9,
    cooldownDays: 30,
    choices: [
      {
        label: '追加预算，一次修到位',
        hint: '高投入，数日后进入验收阶段',
        apply: combo(
          gain({ money: -4000 }, '施工队加班加点，工期重新排定。'),
        ),
        schedule: [{ eventId: 'renovationResult', days: 3 }],
      },
      {
        label: '缩小规模，先修主楼',
        hint: '低成本方案',
        apply: combo(
          gain({ money: -800, teaching: 60 }),
        ),
        schedule: [{ eventId: 'renovationResult', days: 3 }],
      },
    ],
  },
  {
    id: 'renovationResult',
    title: '工程验收',
    icon: '✅',
    text: '维修工程进入验收阶段，上级部门派来了第三方检测机构。',
    category: '校园',
    weight: 0,
    cooldownDays: 10,
    choices: [
      {
        label: '按标准流程验收',
        hint: '稳定收益',
        apply: combo(
          gain({ reputation: 15, parentTrust: 15 }),
          text('检测报告全部合格，家长群里第一次出现了长段的夸奖。'),
        ),
      },
      {
        label: '追加智能化改造',
        hint: '额外投入，长期效果',
        effects: [{ target: 'build_speed', op: 'mul', value: 0.04 }],
        apply: combo(
          gain({ money: -2500, research: 100 }, '新校舍装上了全套智能监测。'),
        ),
      },
    ],
  },
  /* ------------------------------ 社团 · 部活 ------------------------------ */
  {
    id: 'clubRecruitWeek',
    title: '社团联合招募周',
    icon: '📣',
    text: '开学第二周，所有社团挤在中庭摆摊。动漫社放了一整面墙的立绘，轻音社直接把音箱搬了出来，超自然研究社的摊位上摆着一本手写的《本校怪谈记录》。',
    category: '校园',
    weight: 12,
    cooldownDays: 20,
    requires: { buildings: { teachingBuilding: 2 } },
    choices: [
      {
        label: '批经费，让学生自己办',
        hint: '活跃度与满意度提升，社团规模扩大',
        apply: combo(
          gain({ money: -800, activity: 90, culture: 60 }, '招募周结束时，有三个社团的报名表不够用。'),
          studentDelta({ satisfaction: 5, social: 2 }),
        ),
      },
      {
        label: '只提供场地与桌椅',
        hint: '低成本，收益有限',
        apply: combo(gain({ activity: 40, culture: 20 }), studentDelta({ satisfaction: 2 })),
      },
    ],
  },
  {
    id: 'clubRoomDispute',
    title: '部室分配争执',
    icon: '🚪',
    text: '部室栋翻新后多出两间空房。动漫社、轻音社、超自然研究社同时递交了申请，理由一个比一个充分。',
    category: '校园',
    weight: 10,
    cooldownDays: 25,
    requires: { buildings: { clubBuilding: 1 } },
    choices: [
      {
        label: '公开答辩，由学生投票决定',
        hint: '满意度与活跃度提升',
        apply: combo(
          gain({ activity: 70, culture: 40 }, '答辩会开了一整个午休，最后动漫社拿到靠窗那间。'),
          studentDelta({ satisfaction: 4, social: 1.5 }),
        ),
      },
      {
        label: '按社员人数与成果分配',
        hint: '效率优先，落选社团略不满',
        apply: combo(
          gain({ activity: 45, culture: 30 }),
          studentDelta({ satisfaction: -1, stress: 1 }),
        ),
      },
    ],
  },
  {
    id: 'lightMusicLive',
    title: '轻音社的首次演出',
    icon: '🎸',
    text: '轻音社想在学园祭前办一场小型 LIVE。她们只有三首歌、两把旧吉他和一个总在关键时刻断音的贝斯音箱。',
    category: '校园',
    weight: 11,
    cooldownDays: 30,
    requires: { clubLevels: { lightMusic: 1 } },
    choices: [
      {
        label: '拨经费租一套专业音响',
        hint: '效果最好，成本不低',
        apply: combo(
          gain({ money: -1200, culture: 120, reputation: 10 }, '那三首歌被全校记住了。'),
          studentDelta({ arts: 1.5, satisfaction: 6 }),
          setFlag('lightMusicLiveOk'),
        ),
      },
      {
        label: '用大礼堂原有的旧设备',
        hint: '省钱，演出效果打折',
        apply: combo(
          gain({ money: -200, culture: 60 }),
          studentDelta({ arts: 0.8, satisfaction: 3 }, '副歌第二遍又断音了，观众却跟着拍起了节奏。'),
        ),
      },
      {
        label: '让学生先练到年底再说',
        hint: '避免风险，士气受损',
        apply: combo(
          studentDelta({ satisfaction: -3, arts: 0.2 }),
          text('社员们把排练时间改到了放学后，谁也没说话。'),
        ),
      },
    ],
  },
  {
    id: 'occultInvestigation',
    title: '超自然研究社的调查',
    icon: '👻',
    text: '超自然研究社申请在旧教学楼通宵调查「第七级台阶」的传闻。他们提交了完整的申请材料，包括监护人同意书和两条应急方案。',
    category: '特殊',
    weight: 9,
    cooldownDays: 40,
    requires: { clubLevels: { occult: 1 } },
    choices: [
      {
        label: '批准，并让教师陪同',
        hint: '安全合规，收获一般',
        apply: combo(
          gain({ activity: 80, culture: 60, research: 40 }, '他们没有拍到鬼，但整理了三十页的口述史。'),
          studentDelta({ research: 1, satisfaction: 4 }),
        ),
      },
      {
        label: '放手让他们自己组织',
        hint: '活跃度与创造力大幅提升，风险自负',
        apply: combo(
          gain({ activity: 150, culture: 90, research: 60 }, '那一晚的记录后来成了学园祭上最受欢迎的展位。'),
          studentDelta({ creativity: 1.5, research: 1, satisfaction: 6, stress: 2 }),
          setFlag('occultNight'),
        ),
      },
      {
        label: '以安全为由驳回',
        hint: '省事，但学生不服',
        apply: combo(
          studentDelta({ satisfaction: -4, stress: 1 }),
          text('社团把申请书收进文件夹，又在下一次会议上原封不动地递了上来。'),
        ),
      },
    ],
  },
  {
    id: 'divingGear',
    title: '潜水社的器材',
    icon: '🤿',
    text: '潜水社的调节器已经用了六年。社长拿着一份检测报告来找你：不是不能用了，是不敢让人用了。',
    category: '校园',
    weight: 9,
    cooldownDays: 35,
    requires: { clubLevels: { diving: 1 } },
    choices: [
      {
        label: '采购全套新装备',
        hint: '花钱换安全与士气',
        apply: combo(
          gain({ money: -3000, sports: 80, parentTrust: 18 }, '器材室里第一次有了全新的装备柜。'),
          studentDelta({ health: 2, satisfaction: 6, sports: 1 }),
        ),
      },
      {
        label: '逐年替换，先换最关键的部件',
        hint: '稳妥方案',
        apply: combo(
          gain({ money: -1200, sports: 30 }),
          studentDelta({ satisfaction: 2 }),
        ),
      },
      {
        label: '先暂停水下训练',
        hint: '安全但社团受挫',
        apply: combo(
          studentDelta({ satisfaction: -5, sports: -1 }),
          gain({ parentTrust: 6 }),
        ),
      },
    ],
  },
  {
    id: 'studentCouncilElection',
    title: '学生会选举',
    icon: '🗳️',
    text: '学生会的选举季到了。今年有两组候选人：一组主张扩大社团预算，另一组主张把经费投给学习辅导。',
    category: '特殊',
    weight: 10,
    cooldownDays: 40,
    requires: { tech: ['studentAutonomy'] },
    choices: [
      {
        label: '完全公开选举，学校不干预',
        hint: '满意度与活跃度提升',
        apply: combo(
          gain({ activity: 120, parentTrust: 20 }, '投票率超过八成，连高三都来了。'),
          studentDelta({ satisfaction: 5, morality: 1 }),
        ),
      },
      {
        label: '建议经费五五开',
        hint: '平衡方案，学生觉得被插手了',
        apply: combo(
          gain({ activity: 60, culture: 40, research: 40 }),
          studentDelta({ satisfaction: -2 }),
        ),
      },
    ],
  },
  {
    id: 'festivalPrepMeeting',
    title: '学园祭筹备会议',
    icon: '🎏',
    text: '筹备委员会把第一版方案放在你面前：摊位区、舞台、后夜祭，还有一张不太好看的预算表。',
    category: '季节',
    weight: 16,
    seasons: ['autumn'],
    cooldownDays: 20,
    requires: { totalClubLevels: 4 },
    choices: [
      {
        label: '主题交给学生定，学校只出预算',
        hint: '学园祭评分与满意度提升',
        effects: [{ target: 'festival_score', op: 'mul', value: 0.03 }],
        apply: combo(
          gain({ money: -1500, culture: 120, activity: 100 }, '今年的主题是「我们还没决定名字」，海报贴满了整条走廊。'),
          studentDelta({ satisfaction: 5, creativity: 1 }),
        ),
      },
      {
        label: '学校定主题，保证安全与秩序',
        hint: '稳妥，创意受限',
        apply: combo(
          gain({ money: -800, culture: 60, parentTrust: 15 }),
          studentDelta({ satisfaction: 1 }),
        ),
      },
      {
        label: '缩小规模，只办一天',
        hint: '省钱，但学生不服',
        apply: combo(
          gain({ money: -200 }),
          studentDelta({ satisfaction: -4, stress: 1 }),
        ),
      },
    ],
  },
  {
    id: 'afterFestival',
    title: '后夜祭',
    icon: '🎆',
    text: '学园祭最后一天夜里，学生在中庭点起了篝火。有人开始唱歌，有人抱着还没收完的展板坐在地上。值班教师看了你一眼，等你决定。',
    category: '校园',
    weight: 12,
    seasons: ['autumn'],
    cooldownDays: 120,
    requires: { totalClubLevels: 8 },
    choices: [
      {
        label: '默许，并留下来陪他们到结束',
        hint: '一次会被讲很多年的后夜祭',
        apply: combo(
          gain({ culture: 180, activity: 160, parentTrust: 20 }, '篝火熄了之后，没有人立刻回宿舍。'),
          studentDelta({ satisfaction: 8, stress: -6, social: 2 }),
          setFlag('afterFestival'),
        ),
      },
      {
        label: '按规定时间清场',
        hint: '安全第一，气氛冷却',
        apply: combo(
          gain({ parentTrust: 12 }),
          studentDelta({ satisfaction: -3 }),
          text('值周教师拿着手电走完了每一圈。第二天，中庭的痕迹被扫得很干净。'),
        ),
      },
    ],
  },
  {
    id: 'festivalRain',
    title: '学园祭当天暴雨',
    icon: '☔',
    text: '学园祭第一天清晨开始下雨。摊位手册是按晴天写的，舞台在中庭，音响线缆全在室外。',
    category: '季节',
    weight: 14,
    seasons: ['autumn', 'summer'],
    cooldownDays: 30,
    requires: { totalClubLevels: 6 },
    choices: [
      {
        label: '紧急把摊位搬进教学楼走廊',
        hint: '花一笔钱，保住大部分活动',
        apply: combo(
          gain({ money: -1200, culture: 80, activity: 60 }, '走廊里的摊位比中庭还挤，反而更热闹了。'),
          studentDelta({ satisfaction: 3, stress: 2 }),
        ),
      },
      {
        label: '舞台移到礼堂，摊位取消',
        hint: '演出保住了',
        apply: combo(
          gain({ culture: 40, activity: 20 }),
          studentDelta({ satisfaction: -2 }),
        ),
      },
      {
        label: '按原计划进行',
        hint: '一场所有人都记得的学园祭',
        apply: combo(
          gain({ reputation: 20, activity: 120, culture: 60 }, '雨里演出完了全场，没有人提前退场。'),
          studentDelta({ satisfaction: 4, health: -2, stress: 3 }),
          setFlag('festivalRainStory'),
        ),
      },
    ],
  },
  {
    id: 'inventoryAudit',
    title: '期末物资盘点',
    icon: '📦',
    text: '学期末，总务处拿着一份盘点表来找你：库房里的器材少了一批，教材领用记录也对不上号。表上有一栏写着「历年如此」。',
    category: '校园',
    weight: 11,
    cooldownDays: 40,
    requires: { buildings: { textbookStore: 1 } },
    choices: [
      {
        label: '组织学生一起彻底盘点',
        hint: '占用课时，但库房管理从此有了底账',
        cost: { teaching: 600 },
        gain: { money: 1200 },
        studentDelta: { morality: 1, satisfaction: -1 },
        notes: ['盘点表从十几页缩到了一页，库房的账终于对上了。'],
        effects: [{ target: 'storage', op: 'mul', value: 0.03 }],
      },
      {
        label: '按老规矩签字了事',
        hint: '省事，但东西只会越来越对不上',
        gain: { parentTrust: 5 },
        notes: ['总务处把表收走了，谁都知道明年还会看到它。'],
      },
      {
        label: '追查到底，公示结果',
        hint: '会得罪人，但风气会变',
        cost: { money: 800 },
        gain: { money: 400, parentTrust: 15 },
        studentDelta: { morality: 2, satisfaction: -3 },
        notes: ['三位后勤人员的名字出现在公示栏上，之后的领用单再没人敢乱填。'],
      },
    ],
  },
  /* ------------------------------ 校队剧情 ------------------------------ */
  {
    id: 'seniorRetirement',
    title: '高三队员的退役赛',
    icon: '🎓',
    text: '训练结束后，队长把你叫到一边。她说：「打完这场，我们就该回去准备考试了。」更衣室里没有人说话，有人把队服叠得很整齐。',
    category: '学生',
    weight: 14,
    cooldownDays: 60,
    seasons: ['autumn', 'winter'],
    requires: { teamFounded: ['basketball'] },
    choices: [
      {
        label: '为他们办一场正式的退役赛，全校来看',
        hint: '花一笔钱，换回士气和全校的记忆',
        cost: { money: 2000, teaching: 300 },
        gain: { activity: 120, alumniContribution: 80, parentTrust: 30 },
        studentDelta: { satisfaction: 5, morality: 2 },
        notes: ['那天中庭挂满了旧队服，退役仪式结束时全场起立鼓掌。'],
        effects: [{ target: 'team_training', op: 'mul', value: 0.02 }],
      },
      {
        label: '简单送一份纪念品',
        hint: '低成本，队员们情绪复杂',
        cost: { money: 400 },
        teamDelta: { teamId: 'basketball', morale: -6 },
        studentDelta: { satisfaction: -1 },
        notes: ['队长笑着收了礼物，回更衣室后把门关了很久。'],
      },
      {
        label: '请她们留下来当助理教练',
        hint: '实力与士气提升，但要占用她们的复习时间',
        cost: { teaching: 500 },
        teamDelta: { teamId: 'basketball', strength: 6, morale: 5 },
        studentDelta: { academic: -0.4, satisfaction: 3 },
        notes: ['三位退役队员留下来带新人，她们的复习计划被推迟了一个月。'],
      },
    ],
  },
  {
    id: 'teamRomance',
    title: '队服里的信',
    icon: '💌',
    text: '队里的两名主力最近总是同时消失。有人在他的柜子里看到一封信，也有人在放学后的操场看见他们一起走。队里开始有人开玩笑了。',
    category: '学生',
    weight: 12,
    cooldownDays: 45,
    requires: { teamFounded: ['basketball'] },
    choices: [
      {
        label: '当作不知道，青春就这一次',
        hint: '士气与满意度提升',
        teamDelta: { teamId: 'basketball', morale: 8, strength: 2 },
        studentDelta: { satisfaction: 4, stress: -2 },
        notes: ['那阵子队里的训练气氛好得反常，连替补都在加练。'],
      },
      {
        label: '找班主任做一次谈话',
        hint: '纪律与压力上升，士气下降',
        teamDelta: { teamId: 'basketball', morale: -5 },
        studentDelta: { morality: 1, stress: 3, satisfaction: -3 },
        gain: { parentTrust: 12 },
        notes: ['两个人的关系变得更加小心，训练时也不再说话了。'],
      },
      {
        label: '定一条队规：训练期间不谈私事',
        hint: '短期士气下降，长期训练效率提升',
        teamDelta: { teamId: 'basketball', morale: -3 },
        studentDelta: { stress: 2 },
        effects: [{ target: 'team_training', op: 'mul', value: 0.02 }],
        notes: ['新队规贴在更衣室门上，第一周没有人迟到。'],
      },
    ],
  },
  {
    id: 'firstTeamVictory',
    title: '队史上的第一场胜利',
    icon: '🎉',
    text: '终场哨响的时候，替补席上的人冲进了场。有人在哭，有人在笑，教练站在场边没动，只是把手里的战术板抱得很紧。',
    category: '学生',
    weight: 13,
    cooldownDays: 90,
    requires: { teamFounded: ['basketball'] },
    choices: [
      {
        label: '给他们放一天假，去哪都行',
        hint: '士气大幅提升，课程略受影响',
        gain: { activity: 80 },
        teamDelta: { teamId: 'basketball', morale: 12 },
        studentDelta: { satisfaction: 5, academic: -0.3 },
        notes: ['第二天训练场空着，队员们去市区吃了一顿拉面。'],
      },
      {
        label: '照常训练，把这股劲留到下一场',
        hint: '实力提升，士气小幅回落',
        teamDelta: { teamId: 'basketball', strength: 4, morale: -2 },
        studentDelta: { stress: 1 },
        notes: ['教练只说了一句：「这场不算什么。」'],
      },
    ],
  },
  {
    id: 'teamBudgetRequest',
    title: '队服与器材预算',
    icon: '🧾',
    text: '体育组递上来一份申请：队服要换新、训练用球已经磨平了，还有一双要换的专业鞋。总务处在旁边写了一句「本学期额度已紧张」。',
    category: '教师',
    weight: 12,
    cooldownDays: 35,
    requires: { teamFounded: ['basketball'] },
    choices: [
      {
        label: '全额批准，该花的钱不能省',
        hint: '花钱换实力与士气',
        cost: { money: 3000 },
        teamDelta: { teamId: 'basketball', strength: 5, morale: 6 },
        gain: { parentTrust: 10 },
        notes: ['新队服发下来那天，队员们穿着在校园里走了一整圈。'],
      },
      {
        label: '先买最必要的，其余下学年再说',
        hint: '折中方案',
        cost: { money: 1200 },
        teamDelta: { teamId: 'basketball', strength: 2, morale: -2 },
        notes: ['教练把清单折起来，说「够用了」。'],
      },
      {
        label: '让队员自己找赞助',
        hint: '不花钱，但会占用训练时间',
        studentDelta: { social: 2, stress: 3 },
        teamDelta: { teamId: 'basketball', strength: -2, morale: 1 },
        gain: { money: 900, activity: 40 },
        notes: ['他们跑遍了周边的店，最后凑到了队服的钱。'],
      },
    ],
  },
]

export const EVENT_MAP: Record<string, EventDef> = EVENT_DEFS.reduce(
  (acc, def) => {
    acc[def.id] = def
    return acc
  },
  {} as Record<string, EventDef>,
)

/** weight = 0 的事件只通过 schedule 触发，不进入随机池 */
export const RANDOM_EVENT_IDS = EVENT_DEFS.filter((e) => e.weight > 0).map((e) => e.id)
