# 架构说明

## 一、总体结构

```
玩家操作（Vue 组件）
      │  调用 GameEngine 的方法（build / toggleCourse / research / …）
      ▼
GameEngine（唯一的状态持有者，Vue reactive 包装）
      │  在 step() 中按固定顺序调用各系统模块
      ▼
各系统模块（函数式：接收 state + ModifierIndex + hooks，修改 state）
      │  读取公式（src/game/formulas）
      │  读取内容数据（src/data）
      ▼
响应式状态变化 → Vue 重新渲染 UI
```

核心约束：

- **UI 不直接修改 `GameState`**。所有写操作都通过 `GameEngine` 暴露的方法（例外：`settings.*` 这类纯界面偏好直接双向绑定）。
- **公式不写在组件里**。所有数值计算都在 `src/game/formulas/index.ts`。
- **内容不写在逻辑里**。新增建筑 / 课程 / 科技等只需要修改 `src/data/*`。
- **加成不散落**。所有加成通过 `ModifierIndex` 聚合，公式层只调用 `mods.mul(target)` / `mods.add(target)`。

## 二、模块清单

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| 状态工厂 | `engine/state.ts` | 初始状态、存档规范化（`normalizeState`）、存档版本号 |
| 加成聚合 | `engine/ModifierIndex.ts` | 收集所有来源的 add / mul 修正，提供 breakdown 供 Tooltip 使用 |
| 加成收集 | `engine/ModifierEngine.ts` | 汇总建筑、联动、科技、校规、卡片、传承、永久加成、季节、评级 |
| 时间 | `engine/TimeEngine.ts` | 日历换算、季节修正、事件间隔 |
| 资源 | `engine/ResourceEngine.ts` | 每分钟净产出（含明细）、支付与发放、资源不足保护 |
| 建筑 | `engine/BuildingEngine.ts` | 成本 / 工期 / 可建造判定 / 队列推进 / 取消退款 |
| 课程 | `engine/CourseEngine.ts` | 槽位、教师比例、学生分配、成长与消耗结算、招生加成累计 |
| 学生 | `engine/StudentEngine.ts` | 群体漂移、期末考结算、学年结算（升学 / 毕业 / 校友 / 新生） |
| 教师 | `engine/TeacherEngine.ts` | 压力 / 士气 / 能力漂移、招聘与到岗 |
| 科技 | `engine/TechEngine.ts` | 前置判定、成本与时长、研究进度、解锁联动 |
| 校规 | `engine/PolicyEngine.ts` | 名额计算、施行与废止、统计标记 |
| 活动 | `engine/ActivityEngine.ts` | 可参加判定、成功率、结算与奖励、效果卡掉落 |
| 效果卡 | `engine/CardEngine.ts` | 卡池筛选、权重抽取、三选一、时长与次数管理 |
| 事件 | `engine/EventEngine.ts` | 条件过滤、权重抽取、选项结算、延迟排期 |
| 成就 | `engine/AchievementEngine.ts` | 条件检查与奖励发放 |
| 传承 | `engine/LegacyEngine.ts` | 传承预览、执行传承、传承节点购买、特性生效 |
| 存档 | `engine/SaveEngine.ts` | 序列化、localStorage、导入导出、版本迁移 |
| 离线 | `engine/OfflineEngine.ts` | 离线收益折算与报告 |
| 主引擎 | `engine/GameEngine.ts` | 状态持有、step 编排、玩家操作 API、通知、调试接口 |
| 驱动器 | `engine/GameLoop.ts` | 固定间隔 + 真实时间差，处理标签页节流 |

## 三、主循环 step 顺序

每个 step（默认按最多 30 游戏分钟切片，最多 400 步）依次执行：

1. `time.minutes += dt`
2. `collectModifiers` 刷新加成索引，并刷新学校评级
3. `tickResources`：建筑产出、学费、教师薪资、设施维护
4. `tickCourses`：教师比例与容量分配 → 学生成长 → 教学资源消耗 → 资源产出 → 招生加成
5. `tickStudentDrift`：压力自然消退、满意度回归、健康漂移、长期不学的缓慢退化
6. `tickTeachers`：压力随课程量、士气随压力、能力随教研
7. 队列类：`tickBuildQueue` → `tickHireQueue` → `tickResearch` → `tickActivities` → `tickCards`
8. `tickEvents`（到期后续事件、超时自动处理）→ `rollRandomEvent`
9. 每 60 游戏分钟检查一次成就
10. 日历边界：月份切换（期末考、季节提示）与 9 月学年结算
11. 统计峰值、界面解锁检查、清空产出缓存

顺序是刻意设计的：资源先于课程结算，课程先于学生漂移，界面解锁检查放在最后，保证同一帧内状态自洽。

## 四、加成系统

```ts
mods.push('research_rate', 'mul', 0.15, '科技·学术发表体系')
mods.mul('research_rate')        // → 1.15（1 + Σmul，且不低于 0.05）
mods.add('policy_slots')         // → 1（Σadd）
mods.breakdown('research_rate')  // → { total, percent, parts } 供 Tooltip 展示
```

约定：`mul` 的语义是「相对变化」，`mods.mul()` 的返回值已经包含基准 1，因此公式里写 `value * mods.mul('x')`，**不要**再写 `1 + mods.mul('x')`。

## 五、错误处理与容错

- 主循环 `onFrame` 用 try/catch 包裹：异常只产生一条通知，页面不会白屏。
- 存档读取失败 → 尝试备份槽 → 再失败则新建学园并提示。
- `normalizeState` 对每个字段做类型与范围校验：非法数字（NaN / Infinity / 负数）会被修正，未知 id 会被丢弃。
- 资源不会变成负数或 NaN：`sanitizeResource` 在每次写入时兜底，上限为 `Number.MAX_SAFE_INTEGER / 1000`。
- 随机事件与成就的条件函数用 try/catch 包裹，单个数据错误不会阻塞循环。
- `validateContent()` 在启动与测试中运行，检查加成目标拼写、前置 id 是否存在、重复 id 与科技循环依赖。

## 六、界面层

- `src/ui/game.ts` 提供单例引擎（`gameEngine()` / `gameState()`）与 `stopGame()`。
- 所有面板都是「只读渲染 + 调用引擎方法」，不直接改状态。
- Tooltip 统一使用 `components/Tip.vue`，内容由 `engine.rates()`、`engine.mods.breakdown()` 等计算得出，因此「数值为什么是这样」永远可以解释。
- 标签解锁由引擎维护（`state.ui.unlockedTabs`），组件不自行判断。
- 通知使用 `ref` 数组（`engine.notices`），保证 Vue 响应式追踪；引擎本身不依赖任何 UI 代码。

## 七、性能考虑

- 学生系统是群体模拟（3 个对象），不是数千个体，长时间挂机不会累积对象。
- 资源产出按分钟缓存（`ratesCache`），避免每帧重复计算。
- 通知与日志列表有长度上限（40 / 50 条）。
- 建造队列、事件队列、卡片列表都有上限或自然收敛。
- 离线结算是一次性折算，不做逐步模拟，因此离线 8 小时与离线 5 分钟的开销相同。
- 时间推进自适应切片（`chunk = max(30, total/400)`），跳年这类大跨度推进不会卡死，也不会让数值跳变失稳。

## 八、测试策略

`tests/` 按层次组织：

- `content.test.ts`：数据表自检与数量下限。
- `formulas.test.ts`：纯函数级验证（日历、成本、产出、评级、容量、非法数字）。
- `engine.test.ts`：引擎级行为（资源增长、建造、课程、学生、科技、校规、季节、比赛、卡片、事件、成就、长时间稳定性）。
- `save.test.ts`：存档往返、base64、版本迁移、坏档修复、非法输入。
- `prestige.test.ts`：传承条件与收益、节点购买、特性、离线上限。
- `ui.test.ts`：jsdom 挂载真实组件，验证界面在时间推进与弹窗出现时依旧可渲染。
