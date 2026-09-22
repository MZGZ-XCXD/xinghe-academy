# 存档格式与迁移

## 一、存储位置

| 键 | 内容 |
| --- | --- |
| `xinghe-academy-save` | 当前存档（JSON 字符串） |
| `xinghe-academy-save-backup` | 上一次保存的备份（写入新存档时自动轮换） |

自动保存默认每 30 秒一次（可在【选项】调整 5–300 秒或关闭），页面关闭时也会尝试保存一次。

## 二、结构

```jsonc
{
  "saveVersion": 3,
  "meta": { "createdAt": 0, "lastSavedAt": 0, "sessionStartSeconds": 0, "runIndex": 1, "version": 3 },
  "time": { "minutes": 0, "speed": 1, "paused": false },
  "school": {
    "name": "星河实验学园",
    "rating": 0,
    "policySlots": 2,
    "activePolicies": [],
    "permanentEffects": [],
    "lastAnnualReport": null
  },
  "resources": { "money": 500, "teaching": 60, "reputation": 5 },
  "students": {
    "cohorts": [
      { "grade": 1, "count": 60, "attrs": { "academic": 30 }, "stress": 37, "satisfaction": 61 }
    ],
    "graduates": 0,
    "alumniActive": 0,
    "alumniQuality": 0,
    "recruitBonus": 0,
    "capacityWarned": false
  },
  "teachers": { "groups": [{ "subject": "math", "count": 2, "quality": 45, "stress": 25, "morale": 70 }], "hireQueue": [] },
  "buildings": { "teachingBuilding": { "level": 1 } },
  "buildQueue": [{ "id": "", "buildingId": "", "targetLevel": 2, "startMinute": 0, "endMinute": 60, "durationMinutes": 60 }],
  "courses": { "chinese": { "active": false, "unlocked": true, "totalServedMinutes": 0 } },
  "technologies": { "modernTeaching": { "unlocked": false, "researching": false } },
  "activeActivities": [],
  "activityResults": [],
  "events": { "active": [], "scheduled": [], "log": [], "cooldownUntil": {}, "seenCount": {}, "nextRollMinute": 3600 },
  "cards": { "active": [], "offers": [], "history": [], "pityCounter": 0 },
  "achievements": { "firstBuilding": { "unlocked": false } },
  "legacy": { "points": 0, "lifetimePoints": 0, "historyPoints": 0, "nodes": {}, "perks": {}, "prestigeCount": 0 },
  "statistics": { "totalMoneyEarned": 0, "yearSnapshot": {}, "flags": {}, "activityLog": [] },
  "settings": { "autoSave": true, "autoSaveSeconds": 30, "notifications": true, "speedPresets": [1, 2, 5], "soundEnabled": false },
  "ui": { "unlockedTabs": ["campus", "buildings", "courses", "options"], "tutorialsSeen": [], "activeTab": "campus" }
}
```

（上面为节选，`resources`、`statistics` 等字段实际包含全部键；`...` 表示同结构的其它条目。）

## 三、版本与迁移

当前版本常量：`CURRENT_SAVE_VERSION = 3`（`src/game/engine/state.ts`）。

迁移在 `SaveEngine.migrate()` 中按版本递增执行，随后统一交给 `normalizeState()` 补全与校验：

- **v1 → v2**：学生属性由全局 `students.attributes` + `students.total` 迁移为三个年级群体 `students.cohorts`（按年级均分人数）。
- **v2 → v3**：`school.policy`（单条）迁移为 `school.activePolicies`（数组），新增 `school.permanentEffects`、`school.policySlots` 与 `statistics.yearSnapshot`。
- **未来版本**：在 `migrate()` 中继续追加 `if (version < N)` 分支，**不要修改已有分支**。新增字段只需要在 `createInitialState()` 与 `normalizeState()` 中提供默认值，旧存档即可自动补全。

版本高于当前游戏版本的存档不会被拒绝，而是带警告继续读取（缺失字段补默认值，未知字段忽略）。

## 四、坏档防护

导入或读取时执行以下步骤：

1. `JSON.parse` 失败 → 视为非法输入，返回失败（不会抛到界面）。
2. 不是对象 / 为空 → 记录警告并返回全新学园。
3. `migrate()` 做结构迁移。
4. `normalizeState()` 逐字段校验：
   - 数值字段 `safeNumber` 兜底（NaN / Infinity / 字符串 → 默认值）
   - 资源 `sanitizeResource`（非负、有限、上限 `MAX_SAFE_INTEGER/1000`）
   - 百分比字段 clamp 到 0–100（压力、满意度、学生属性、教师能力）
   - 建筑等级 clamp 到 `0..maxLevel`，未知建筑 id 丢弃
   - 课程 / 科技 / 事件 / 卡片 / 活动 / 成就的 id 必须存在于数据表，否则丢弃
   - 建造队列的目标等级与时间被修正为正数
   - `statistics` 的每个数值字段单独兜底，`flags` 强制为布尔映射
5. 读取槽位失败时自动尝试备份槽，并提示「主存档损坏，已自动读取备份」。

## 五、导出与导入

- **导出**：`engine.exportSave(asBase64?)`。默认输出可读 JSON 字符串；传 `true` 时输出 base64 压缩串（内部仍是同一份 JSON）。导出会设置 `statistics.flags.exportedSave`（用于成就）。
- **导入**：`engine.importSave(text)`，同时接受 JSON 与 base64。导入成功后立即替换引擎状态、重算加成、刷新评级，并回放一次通知。

## 五·二、重置与清空

【选项】面板提供两种重置方式，都会要求二次确认：

| 操作 | 行为 | 保留内容 |
| --- | --- | --- |
| 重新开始本轮（`engine.resetRun()`） | 重开一轮学园，套用传承特性带来的开局加成 | 传承点 / 传承树 / 成就 / 历史统计 / 设置 |
| 清空全部存档（`engine.wipeSave()`） | 删除 `xinghe-academy-save` 与 `xinghe-academy-save-backup`，并重建初始状态 | 什么都不保留（学园名字与设置也回到默认） |

`clearAllStorage()` 会返回实际删除的键名数组，界面据此提示「已删除本地存档（N 项）」；若浏览器禁止本地存储（例如 `file://`），则只重置内存中的状态。

## 六、离线结算与存档的关系

离线收益依赖 `meta.lastSavedAt`：

```
elapsedSeconds = now - lastSavedAt
countedSeconds = min(elapsedSeconds, offlineCapSeconds(mods))   // 默认 8 小时，最高 24 小时
gameMinutes    = countedSeconds × 240 × offlineRate             // offlineRate 默认 0.5%
gameMinutes    = min(gameMinutes, 20 个游戏日)                   // 上限，防止离线压过在线经营
```

离线期间只结算建筑 / 学费 / 课程 / 学生漂移，**不触发**随机事件、比赛结算与学年结算，避免玩家回来后面对大量弹窗或直接跳过整年。
