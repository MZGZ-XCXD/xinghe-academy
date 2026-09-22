import type { ModsView } from '../formulas'

export interface ModifierPart {
  source: string
  op: 'add' | 'mul'
  value: number
}

/**
 * 加成聚合器。
 * 所有建筑、科技、校规、效果卡、传承、季节、成就的加成最终都汇总到这里，
 * 公式层只通过 mul()/add() 读取结果，因此不存在散落在 UI 里的加成计算。
 */
export class ModifierIndex implements ModsView {
  private parts = new Map<string, ModifierPart[]>()
  private addCache = new Map<string, number>()
  private mulCache = new Map<string, number>()

  reset(): void {
    this.parts.clear()
    this.addCache.clear()
    this.mulCache.clear()
  }

  push(target: string, op: 'add' | 'mul', value: number, source: string): void {
    if (!Number.isFinite(value) || value === 0) return
    const list = this.parts.get(target) ?? []
    list.push({ source, op, value })
    this.parts.set(target, list)
    this.addCache.delete(target)
    this.mulCache.delete(target)
  }

  add(target: string): number {
    const cached = this.addCache.get(target)
    if (cached != null) return cached
    const list = this.parts.get(target) ?? []
    const total = list.reduce((sum, p) => (p.op === 'add' ? sum + p.value : sum), 0)
    this.addCache.set(target, total)
    return total
  }

  /** 乘算结果：1 + Σmul，且永不低于 5% */
  mul(target: string): number {
    const cached = this.mulCache.get(target)
    if (cached != null) return cached
    const list = this.parts.get(target) ?? []
    const sum = list.reduce((acc, p) => (p.op === 'mul' ? acc + p.value : acc), 0)
    const total = Math.max(0.05, 1 + sum)
    this.mulCache.set(target, total)
    return total
  }

  /** 用于 Tooltip：展示某个加成指标的全部来源 */
  breakdown(target: string): { total: number; percent: number; parts: ModifierPart[] } {
    const list = this.parts.get(target) ?? []
    return {
      total: this.mul(target),
      percent: this.mul(target) - 1,
      parts: [...list].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    }
  }

  get size(): number {
    let n = 0
    for (const list of this.parts.values()) n += list.length
    return n
  }
}
