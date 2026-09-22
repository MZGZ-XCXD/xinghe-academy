/**
 * 把 Vite 的产物合并成一个可以双击打开的 HTML 文件。
 *
 * 用法：npm run build:single
 * 产物：outputs/星河实验学园.html（单文件，无外部依赖）
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'dist-single')
const targetDir = resolve(root, 'outputs')
const targetFile = resolve(targetDir, '星河实验学园.html')

console.log('① 打包（IIFE 单入口）…')
const viteBin = resolve(root, 'node_modules/vite/bin/vite.js')
if (!existsSync(viteBin)) throw new Error('没有找到 vite，请先执行 npm install')
execFileSync(process.execPath, [viteBin, 'build', '--config', 'vite.singlefile.config.ts'], {
  cwd: root,
  stdio: 'inherit',
})

const htmlPath = resolve(outDir, 'index.html')
if (!existsSync(htmlPath)) throw new Error('没有找到 dist-single/index.html')

let html = readFileSync(htmlPath, 'utf8')

/**
 * 内联所有资源。
 * 注意：原来的 <script type="module"> 自带 defer；内联成普通 <script> 后必须放到 </body> 之前，
 * 否则会在 <div id="app"> 出现之前执行，Vue 找不到挂载点。
 */
function inline(htmlText) {
  let result = htmlText
  const scripts = []

  // 1. 样式表内联到原位
  result = result.replace(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (match, href) => {
    const file = resolve(outDir, href.replace(/^\.?\//, ''))
    if (!existsSync(file)) return match
    return `<style>\n${readFileSync(file, 'utf8')}\n</style>`
  })

  // 2. 抽出脚本内容
  result = result.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (match, src) => {
    // 带 data-external 的是「桌面内容入口」（校园内容.js），保持外链，不内联
    if (match.includes('data-external')) return match
    const file = resolve(outDir, src.replace(/^\.?\//, ''))
    if (!existsSync(file)) return match
    scripts.push(readFileSync(file, 'utf8').replace(/<\/script>/gi, '<\\/script>'))
    return ''
  })

  // 3. 去掉残余的 modulepreload 引用
  result = result.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '')

  // 4. 脚本统一放到 body 末尾
  const payload = scripts.map((js) => `<script>\n${js}\n</script>`).join('\n')
  if (payload) {
    // 注意：必须用函数式替换，否则 JS 里的 $' / $& 等序列会被当成替换模式
    if (result.includes('</body>')) result = result.replace('</body>', () => `${payload}\n</body>`)
    else result += payload
  }
  return result
}

html = inline(html)

const leftovers = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((url) => !url.startsWith('data:'))
const unexpected = leftovers.filter((url) => !url.includes('校园内容.js'))
if (unexpected.length > 0) {
  console.warn('⚠ 仍然存在外部引用：', unexpected.join(', '))
}

const banner = `<!--
  星河实验学园 · 单文件版
  用法：双击本文件即可在浏览器中打开，不需要网络、不需要服务器。
  存档：浏览器 localStorage（部分浏览器在 file:// 下会禁止），可在【选项】里用导出/导入存档做备份。
  重新打包：npm run build:single
-->
`
html = html.replace(/^<!doctype html>/i, (match) => `${match}\n${banner}`)

mkdirSync(targetDir, { recursive: true })
writeFileSync(targetFile, html, 'utf8')
writeFileSync(resolve(outDir, '星河实验学园.html'), html, 'utf8')

// 一起产出「内容入口」与教程，方便放到桌面
const contentTemplate = resolve(root, 'public/校园内容.js')
if (existsSync(contentTemplate)) {
  writeFileSync(resolve(targetDir, '校园内容.js'), readFileSync(contentTemplate, 'utf8'), 'utf8')
  console.log('③ 已生成内容入口：outputs/校园内容.js')
}
const tutorial = resolve(root, 'templates/如何添加内容.md')
if (existsSync(tutorial)) {
  writeFileSync(resolve(targetDir, '如何添加内容.md'), readFileSync(tutorial, 'utf8'), 'utf8')
  console.log('④ 已生成教程：outputs/如何添加内容.md')
}

if (!html.includes('校园内容.js')) {
  console.warn('⚠ 单文件里没有引用「校园内容.js」，外部内容入口不会生效')
}

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0)
console.log(`② 已生成单文件：${targetFile}（约 ${kb} KB）`)
