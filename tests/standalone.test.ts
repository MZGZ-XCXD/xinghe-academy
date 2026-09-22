// @vitest-environment jsdom
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'

const FILE = resolve(process.cwd(), 'outputs/星河实验学园.html')
const CONTENT_FILE = resolve(process.cwd(), 'outputs/校园内容.js')

/**
 * 单文件版校验：只有在执行过 `npm run build:single` 之后才会运行。
 * 验证方式：把 HTML 里的内联脚本真的执行一遍，确认游戏能挂载出界面。
 */
describe('单文件版（桌面双击打开）', () => {
  const hasFile = existsSync(FILE)

  it.skipIf(!hasFile)('除「校园内容.js」外没有任何外部资源引用', () => {
    const html = readFileSync(FILE, 'utf8')
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((url) => !url.startsWith('data:'))
      .filter((url) => !url.includes('校园内容.js'))
    expect(refs).toEqual([])
    expect(html).toContain('<style>')
    expect(html).toContain('<script>')
    expect(html).not.toContain('type="module"')
    // 内容入口必须保留为外链，方便用户直接编辑
    expect(html).toContain('校园内容.js')
    expect(html).toContain('data-external')
  })

  it.skipIf(!hasFile)('内联脚本可以直接在浏览器环境跑出游戏界面（含 file:// 禁止 localStorage 的情况）', async () => {
    const html = readFileSync(FILE, 'utf8')
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      // 模拟「双击打开本地文件」：file:// 下浏览器会禁止 localStorage
      url: 'file:///C:/Users/me/Desktop/game.html',
    })
    // 等待 Vue 挂载与主循环第一帧
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400))
    const app = dom.window.document.querySelector('#app')
    expect(app?.children.length ?? 0).toBeGreaterThan(0)
    // 只看真正的界面文本（排除 <script> 里的打包代码）
    const text = app?.textContent ?? ''
    expect(text).toContain('校园信息')
    expect(text).toContain('学校资源')
    expect(text).toContain('校园主视图')
    expect(text).toContain('教学楼')
    // localStorage 被禁止时也应该正常启动（只是不能自动保存）
    let storageBlocked = false
    try {
      void dom.window.localStorage.length
    } catch {
      storageBlocked = true
    }
    expect(storageBlocked).toBe(true)
    dom.window.close()
  })

  it.skipIf(!hasFile || !existsSync(CONTENT_FILE))(
    '把 HTML 与「校园内容.js」放在同一文件夹时，外部内容会被加载',
    async () => {
      const dir = mkdtempSync(resolve(tmpdir(), 'academy-desktop-'))
      const htmlPath = resolve(dir, '星河实验学园.html')
      const contentPath = resolve(dir, '校园内容.js')
      copyFileSync(FILE, htmlPath)
      // 模拟用户把示例的注释去掉（只启用一门课，便于断言）
      const template = readFileSync(CONTENT_FILE, 'utf8')
      const enabled = template
        .replace("  courses: [\n", '  courses: [\n    {\n      id: \'desktopTestCourse\',\n      name: \'桌面测试课程\',\n      icon: \'🧪\',\n      desc: \'来自桌面的课程\',\n      category: \'特色课程\',\n      subject: \'science\',\n      teacherRequired: 1,\n      slotCost: 1,\n      capacity: 40,\n      teachingCostPerStudentMinute: 0.001,\n      growth: { research: 0.01 },\n      requires: { buildings: { teachingBuilding: 1 } },\n    },\n')
      writeFileSync(contentPath, enabled, 'utf8')

      const dom = new JSDOM(readFileSync(htmlPath, 'utf8'), {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        url: `file:///${htmlPath.replace(/\\/g, '/')}`,
      })
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 900))
      const academy = (dom.window as unknown as { academy?: { content: () => { count: number; found: boolean } } }).academy
      expect(academy).toBeDefined()
      const status = academy!.content()
      expect(status.found).toBe(true)
      expect(status.count).toBeGreaterThanOrEqual(1)
      dom.window.close()
    },
  )
})
