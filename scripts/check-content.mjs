/**
 * 校园内容.js 本地体检：npm run check:content [文件路径]
 *
 * 在打开游戏之前就能发现最常见的三类问题：
 *   1. 语法错误（全角标点、漏逗号、括号不配对）——这会让整份文件一条都不生效
 *   2. 代码位置上误用了全角标点（中文输入法打出来的 ，：；（）“”）
 *   3. 一眼看清到底写了几条内容、分别是哪些类别
 *
 * 不传路径时依次尝试：public/校园内容.js → 桌面上的 校园内容.js
 */
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { writeFileSync, unlinkSync } from 'node:fs'

const CANDIDATES = [
  resolve(process.cwd(), 'public/校园内容.js'),
  resolve(homedir(), 'Desktop/校园内容.js'),
]

const target = process.argv[2] ? resolve(process.argv[2]) : CANDIDATES.find((p) => existsSync(p))
if (!target || !existsSync(target)) {
  console.error('找不到 校园内容.js。用法：npm run check:content [文件路径]')
  process.exit(1)
}

console.log(`检查文件：${target}\n`)
const text = readFileSync(target, 'utf8')

/* ---------- 1. 语法检查 ---------- */
const temp = resolve(tmpdir(), `check-content-${Date.now()}.mjs`)
writeFileSync(temp, text, 'utf8')
let syntaxOk = true
let syntaxMessage = ''
try {
  execFileSync(process.execPath, ['--check', temp], { stdio: 'pipe' })
} catch (error) {
  syntaxOk = false
  syntaxMessage = String(error.stderr ?? error.stdout ?? '')
}
unlinkSync(temp)

if (syntaxOk) {
  console.log('① 语法：通过 ✅')
} else {
  console.log('① 语法：不通过 ❌ —— 整个文件都不会被游戏读取，必须先修好这一条')
  const lines = syntaxMessage.split('\n').filter((l) => l.trim()).slice(0, 6)
  for (const line of lines) console.log('   ' + line)
  console.log('   （最常见原因：用了中文全角标点 ，：；（） 或漏了逗号）\n')
}

/* ---------- 2. 全角标点检查（只看代码位置，引号内与注释里不算） ---------- */
const FULLWIDTH = { '，': ',', '：': ':', '；': ';', '（': '(', '）': ')', '“': '"', '”': '"', '‘': "'", '’': "'" }
const suspects = []
let inBlockComment = false
text.split(/\r?\n/).forEach((line, index) => {
  const trimmed = line.trim()
  if (inBlockComment) {
    if (line.includes('*/')) inBlockComment = false
    return
  }
  if (trimmed.startsWith('/*')) {
    if (!line.includes('*/')) inBlockComment = true
    return
  }
  if (trimmed.startsWith('//') || trimmed === '') return
  let quote = null
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (FULLWIDTH[ch]) suspects.push({ line: index + 1, ch, suggest: FULLWIDTH[ch], text: trimmed })
  }
})

if (suspects.length === 0) {
  console.log('② 全角标点：没有发现 ✅（引号里的中文标点是正常的）')
} else {
  console.log(`② 全角标点：发现 ${suspects.length} 处，需要改成半角 ❌`)
  for (const s of suspects.slice(0, 20)) {
    console.log(`   第 ${s.line} 行：「${s.ch}」应改成「${s.suggest}」  ${s.text.slice(0, 60)}`)
  }
  if (suspects.length > 20) console.log(`   ……还有 ${suspects.length - 20} 处`)
}

/* ---------- 3. 数一数写了几条 ---------- */
const CATEGORIES = [
  'courses',
  'policies',
  'techs',
  'events',
  'buildings',
  'clubs',
  'teams',
  'activities',
  'cards',
  'achievements',
  'legacyNodes',
  'synergies',
]
const counts = []
let current = null
text.split(/\r?\n/).forEach((line) => {
  const open = line.match(/^\s{2}([a-zA-Z]+):\s*\[/)
  if (open) current = open[1]
  if (current && /^\s*\{\s*$/.test(line.replace(/\/\/.*$/, ''))) counts.push(current)
})
const summary = CATEGORIES.map((c) => [c, counts.filter((x) => x === c).length]).filter(([, n]) => n > 0)

console.log('\n③ 生效中的条目（没加 // 注释的才算）')
if (summary.length === 0) {
  console.log('   0 条 —— 所有示例都还是注释状态；把想用的那一段前面的 // 去掉即可')
} else {
  const label = {
    courses: '课程',
    policies: '校规',
    techs: '科技',
    events: '事件',
    buildings: '建筑',
    clubs: '社团',
    teams: '校队',
    activities: '活动',
    cards: '效果卡',
    achievements: '成就',
    legacyNodes: '传承节点',
    synergies: '建筑联动',
  }
  for (const [key, n] of summary) console.log(`   ${label[key] ?? key}：${n} 条`)
  console.log(`   合计 ${counts.length} 条`)
}

console.log('\n提示：改完文件后回到游戏按 Ctrl+F5 强制刷新；游戏内 F12 可执行 academy.content() / academy.problems()。')
process.exit(syntaxOk ? 0 : 1)
