<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { fmt } from '../ui/format'
import { saveSizeBytes } from '../game/engine/SaveEngine'
import { storageAvailable } from '../game/engine/SaveEngine'
import { formatOfflineDuration } from '../game/engine/OfflineEngine'

const engine = gameEngine()
const state = gameState()

const exportText = ref('')
const importText = ref('')
const message = ref('')
const confirmReset = ref(false)
const confirmWipe = ref(false)
const nameInput = ref(state.school.name)
const NAME_SUGGESTIONS = ['星见丘学园', '未名高级中学', '钟鸣学园', '白鹭洲高级中学', '樱丘高级中学', '青岚学园']
/** 界面大小预设：等价于浏览器 Ctrl+滚轮缩放 */
const UI_SCALES = [1, 1.25, 1.5, 1.75, 2, 2.5]

const offlineReport = computed(() => engine.offlineReport)
const saveSize = computed(() => `${(saveSizeBytes(state) / 1024).toFixed(1)} KB`)
const storageOk = computed(() => storageAvailable())
const external = computed(() => engine.externalContent())
const externalKinds = computed(() =>
  Object.entries(external.value.byKind)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(' · '),
)

function doExport(base64: boolean) {
  exportText.value = engine.exportSave(base64)
  message.value = base64 ? '已生成压缩（base64）存档字符串，可以复制保存。' : '已生成 JSON 存档字符串，可以复制保存。'
}

async function copyExport() {
  if (!exportText.value) doExport(false)
  try {
    await navigator.clipboard.writeText(exportText.value)
    message.value = '存档已复制到剪贴板。'
  } catch {
    message.value = '无法访问剪贴板，请手动全选复制文本框内容。'
  }
}

function doImport() {
  const result = engine.importSave(importText.value)
  message.value = result.ok
    ? `导入成功。${result.warnings.length > 0 ? result.warnings.join(' ') : ''}`
    : result.warnings.join(' ')
}

function doSave() {
  const ok = engine.save()
  message.value = ok ? '已手动保存到本地浏览器。' : '保存失败：当前环境不支持本地存储。'
}

function doReset() {
  engine.resetRun()
  confirmReset.value = false
  message.value = '已重新开始本轮学园建设（传承与成就保留）。'
}

function doWipe() {
  const removed = engine.wipeSave()
  exportText.value = ''
  importText.value = ''
  confirmWipe.value = false
  message.value = `已清空全部存档（删除 ${removed.length} 项本地数据），游戏回到全新状态。`
}

function doRename() {
  if (engine.renameSchool(nameInput.value)) {
    nameInput.value = state.school.name
    message.value = `校名已改为「${state.school.name}」并写入存档。`
  } else {
    nameInput.value = state.school.name
    message.value = '改名未生效（校名为空或与当前相同）。'
  }
}

function pickName(name: string) {
  nameInput.value = name
}
</script>

<template>
  <div class="panel">
    <h3>🏫 校名</h3>
    <div class="row wrap">
      <label class="row small">
        现在的校名
        <input
          v-model="nameInput"
          type="text"
          maxlength="24"
          placeholder="输入新的校名"
          style="width: 220px; background: #121a29; color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px"
          @keyup.enter="doRename"
        />
      </label>
      <button class="btn primary" @click="doRename">改名</button>
      <button class="btn ghost" @click="nameInput = state.school.name">还原</button>
      <span class="tag">当前：{{ state.school.name }}</span>
    </div>
    <div class="row wrap" style="margin-top: 8px">
      <span class="small muted">推荐：</span>
      <button
        v-for="name in NAME_SUGGESTIONS"
        :key="name"
        class="btn small"
        :class="{ primary: nameInput === name }"
        @click="pickName(name)"
      >
        {{ name }}
      </button>
    </div>
    <div class="small muted" style="margin-top: 6px">
      校名会显示在顶部标题栏、浏览器标签页与存档里，改完立即写入存档；已有存档也可以随时改。
    </div>
  </div>

  <div class="panel">
    <h3>💾 存档</h3>
    <div class="row wrap">
      <button class="btn primary" @click="doSave">手动保存</button>
      <button class="btn" @click="doExport(false)">导出 JSON</button>
      <button class="btn" @click="doExport(true)">导出压缩串</button>
      <button class="btn" @click="copyExport">复制导出内容</button>
      <span class="tag">存档大小 {{ saveSize }}</span>
      <span class="tag">版本 v{{ state.saveVersion }}</span>
    </div>
    <div class="small muted" style="margin-top: 8px">
      自动保存：{{ state.settings.autoSave ? `每 ${state.settings.autoSaveSeconds} 秒` : '已关闭' }} ·
      上次保存 {{ new Date(state.meta.lastSavedAt).toLocaleTimeString() }}
    </div>
    <div v-if="!storageOk" class="card" style="margin-top: 8px; border-color: rgba(240, 169, 74, 0.5)">
      <strong class="small">⚠ 当前环境不支持自动保存</strong>
      <div class="small muted">
        你可能是直接双击打开的单文件版（`file://`），浏览器禁止了本地存储。
        建议：用下面的「导出 JSON / 压缩串」把存档复制到文本文件保存，下次进来用「导入存档」恢复。
        或者把游戏放到任意静态服务器 / 本地服务器（`npm run dev`）下打开，就能自动保存。
      </div>
    </div>
    <textarea
      v-model="exportText"
      class="import-box"
      style="width: 100%; height: 90px; margin-top: 8px; background: #121a29; color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 8px"
      placeholder="导出的存档会显示在这里"
    ></textarea>
    <div class="row" style="margin-top: 8px">
      <textarea
        v-model="importText"
        style="flex: 1; height: 90px; background: #121a29; color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 8px"
        placeholder="粘贴存档文本（支持 JSON 与压缩串）后点击导入"
      ></textarea>
    </div>
    <div class="row" style="margin-top: 8px">
      <button class="btn" @click="doImport">导入存档</button>
      <button class="btn ghost" @click="confirmReset = true">重新开始本轮</button>
      <button class="btn danger" @click="confirmWipe = true">清空全部存档</button>
    </div>
    <div v-if="message" class="small" style="margin-top: 8px">{{ message }}</div>
    <div v-if="confirmReset" class="card" style="margin-top: 10px">
      <strong>确认重新开始？</strong>
      <div class="small muted">当前学园的建筑、学生、课程、科技与资源都会重置，传承树、成就与历史统计保留。</div>
      <div class="row">
        <button class="btn" @click="doReset">确认</button>
        <button class="btn ghost" @click="confirmReset = false">取消</button>
      </div>
    </div>
    <div v-if="confirmWipe" class="card danger-card" style="margin-top: 10px">
      <strong>确认清空全部存档？</strong>
      <div class="small muted">
        这会删除本地保存的主存档与备份，并把游戏重置为第一次打开的状态：
        学园进度、传承点与传承树、全部成就、历史统计、学园名字与设置都会回到初始值。
        <br />此操作不可撤销。如果想保留进度，请先点上面的「导出 JSON / 压缩串」把存档复制出去。
      </div>
      <div class="row">
        <button class="btn danger" @click="doWipe">确认清空</button>
        <button class="btn ghost" @click="confirmWipe = false">取消</button>
      </div>
    </div>
  </div>

  <div class="panel">
    <h3>⚙️ 设置</h3>
    <div class="row wrap">
      <label class="row small"><input v-model="state.settings.autoSave" type="checkbox" /> 自动保存</label>
      <label class="row small"><input v-model="state.settings.notifications" type="checkbox" /> 显示通知</label>
      <label class="row small">
        <input v-model="state.settings.tutorialsEnabled" type="checkbox" />
        显示剧情引导
      </label>
      <label class="row small">自动保存间隔（秒）
        <input
          v-model.number="state.settings.autoSaveSeconds"
          type="number"
          min="5"
          max="300"
          style="width: 70px; background: #121a29; color: var(--text); border: 1px solid var(--line); border-radius: 6px"
        />
      </label>
      <span class="tag">音效（预留）</span>
    </div>
    <div class="row wrap" style="margin-top: 8px">
      <span class="small muted">界面大小</span>
      <button
        v-for="scale in UI_SCALES"
        :key="scale"
        class="btn small"
        :class="{ primary: Math.abs((state.settings.uiScale ?? 1) - scale) < 0.01 }"
        @click="state.settings.uiScale = scale"
      >
        {{ Math.round(scale * 100) }}%
      </button>
      <span class="small muted">
        高分屏（4K）建议 150% – 200%，效果等同于浏览器 Ctrl+滚轮缩放。
        手机 / 窄屏会自动切换移动版布局（单栏、按钮加大），此时不套用这里的倍率。
      </span>
    </div>
    <div class="small muted" style="margin-top: 8px">
      1× 速度下 1 真实秒 ≈ 0.08 游戏日（1 游戏日约 12 秒现实时间，1 学年约 72 分钟）。可切换 1× / 2× / 5×；
      界面里所有持续时间都写成「游戏天数（现实时间）」，例如「2.4 天（约 25 秒）」。
    </div>
    <div class="row wrap" style="margin-top: 8px">
      <button class="btn small" @click="engine.restartTutorials()">重看剧情引导</button>
      <span class="small muted">
        进度 {{ engine.tutorialProgress().current }} / {{ engine.tutorialProgress().total }} ·
        每次「学园传承」后都会重新播放一次
      </span>
    </div>
    <div v-if="!state.settings.tutorialsEnabled" class="small muted">
      当前已关闭剧情引导：系统仍会在条件满足时自动解锁，只是不再弹出剧情窗口。
    </div>
  </div>

  <div class="panel">
    <h3>🌙 离线结算记录</h3>
    <div v-if="!offlineReport" class="muted small">本次登录没有离线结算记录（或离线时间不足 1 分钟）。</div>
    <template v-else>
      <div class="stat-row">
        <span class="muted">离开时长</span>
        <span class="value">{{ formatOfflineDuration(offlineReport.elapsedSeconds) }}</span>
      </div>
      <div class="stat-row">
        <span class="muted">实际结算</span>
        <span class="value">{{ formatOfflineDuration(offlineReport.countedSeconds) }}</span>
      </div>
      <div class="stat-row">
        <span class="muted">等效游戏时间</span>
        <span class="value">{{ offlineReport.gameDays.toFixed(1) }} 天</span>
      </div>
      <div class="row wrap" style="margin-top: 6px">
        <span v-for="(value, key) in offlineReport.gains" :key="key" class="tag">
          {{ key }} {{ (value ?? 0) > 0 ? '+' : '' }}{{ fmt(Number(value ?? 0)) }}
        </span>
      </div>
      <div v-for="note in offlineReport.notes" :key="note" class="small muted" style="margin-top: 4px">· {{ note }}</div>
    </template>
  </div>

  <div class="panel">
    <h3>
      🧩 自定义内容
      <span class="tag" :class="external.count > 0 ? 'good' : ''">
        {{ external.found ? `已加载 ${external.count} 项` : '未加载' }}
      </span>
    </h3>
    <div class="small muted">
      把 <strong>校园内容.js</strong> 放在游戏 HTML 旁边（同一个文件夹），在里面添加课程 / 校规 / 科技 / 事件 / 建筑 / 社团 / 活动 / 成就 / 传承节点，保存后刷新页面即可生效，不需要重新打包。
      详细写法见同目录下的《如何添加内容.md》。
    </div>
    <div class="small" style="margin-top: 6px">
      <template v-if="external.count > 0">
        已加载：{{ externalKinds }}
      </template>
      <template v-else>
        当前还没有启用任何自定义内容（文件里所有示例都处于注释状态，或文件不存在）。
      </template>
    </div>
    <div v-for="problem in external.problems" :key="problem" class="small warn">· {{ problem }}</div>
  </div>

  <div v-if="engine.debugEnabled" class="panel">
    <h3>🛠️ 调试工具 <span class="tag warn">开发模式</span></h3>
    <div class="row wrap">
      <button class="btn small" @click="engine.debugAddAll(1000000)">全部资源 +1M</button>
      <button class="btn small" @click="engine.debugUnlockAll()">解锁全部科技与课程</button>
      <button class="btn small" @click="engine.debugFinishQueue()">立即完成建造</button>
      <button class="btn small" @click="engine.debugAdvanceDay(1)">跳过 1 天</button>
      <button class="btn small" @click="engine.debugAdvanceMonth()">跳过 1 个月</button>
      <button class="btn small" @click="engine.debugAdvanceYear()">跳过 1 学年</button>
      <button class="btn small" @click="engine.debugTriggerEvent('clubConflict')">触发事件</button>
      <button class="btn small" @click="engine.debugGiveCard()">给一张效果卡</button>
      <button class="btn small" @click="engine.debugPrestige()">直接传承</button>
      <button class="btn small" @click="engine.debugSetRating(70)">评级设为 70</button>
    </div>
    <div class="row wrap" style="margin-top: 8px">
      <button
        v-for="speed in [1, 2, 5, 10, 100]"
        :key="speed"
        class="btn small"
        :class="{ primary: state.time.speed === speed }"
        @click="engine.setSpeed(speed)"
      >
        {{ speed }}×
      </button>
    </div>
    <div class="small muted" style="margin-top: 8px">
      内容自检：{{ engine.contentCheck().length === 0 ? '通过' : engine.contentCheck().join('；') }}
    </div>
  </div>
</template>
