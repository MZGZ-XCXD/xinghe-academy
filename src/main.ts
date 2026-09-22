import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'
import { bootGame } from './ui/game'

const { engine, warnings } = bootGame()

if (warnings.length > 0) {
  console.warn('[存档]', warnings.join('\n'))
}

const contentProblems = engine.contentCheck()
if (contentProblems.length > 0) {
  console.error('[内容自检失败]', contentProblems)
}

// 诊断信息：按 F12 后在控制台输入 academy.content() / academy.problems() 就能看到内容加载情况
if (typeof window !== 'undefined') {
  ;(window as unknown as { academy: unknown }).academy = {
    version: engine.state.saveVersion,
    content: () => engine.externalContent(),
    problems: () => engine.contentCheck(),
    help: 'academy.content() 查看校园内容.js 的加载情况；academy.problems() 查看内容自检问题',
  }
}

createApp(App).mount('#app')
