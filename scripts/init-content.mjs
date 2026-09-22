/**
 * 准备「个性化内容」文件：npm run content:init
 *
 * 把仓库里公开的模板 public/校园内容.示例.js 复制成 public/校园内容.js（你自己的工作副本）。
 * 这个副本已经被 .gitignore 忽略，在里面加课程 / 校规 / 科技 / 事件 / 建筑 / 社团 / 活动 / 成就 / 传承节点都不会被提交、也不会同步到 GitHub。
 */
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const personal = resolve(root, 'public/校园内容.js')
const example = resolve(root, 'public/校园内容.示例.js')

if (existsSync(personal)) {
  console.log('已存在 public/校园内容.js，保持不动（这是你的个性化内容，不会被提交）。')
  process.exit(0)
}

if (!existsSync(example)) {
  console.error('没找到 public/校园内容.示例.js，无法初始化。')
  process.exit(1)
}

copyFileSync(example, personal)
console.log('已生成 public/校园内容.js（来自示例模板）。')
console.log('这个文件已被 .gitignore 忽略：在里面加的内容只在本机生效，不会被推送到 GitHub。')
