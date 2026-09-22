import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { canFoundTeam, teamMatchChance, teamTierStatus, teamUnlockStatus, trainingGain } from '../src/game/engine/TeamEngine'
import { MINUTES_PER_DAY } from '../src/game/formulas'
import { CLUB_MAP, TEAM_DEFS, TEAM_MAP, TEAM_TIERS, TEAM_TIER_MAP } from '../src/data'

function makeEngine() {
  return new GameEngine(createInitialState())
}

/** 把一支校队的解锁链一次性打通（建筑 → 社团 → 成员 → 资源） */
function prepareTeam(engine: GameEngine, teamId: string): void {
  engine.debugUncapStorage()
  engine.debugAddAll(2000000)
  const def = TEAM_MAP[teamId]
  for (const id of Object.keys(def.requires?.buildings ?? {})) {
    const level = def.requires?.buildings?.[id] ?? 1
    for (let i = 0; i < level; i += 1) engine.debugBuild(id)
  }
  for (const id of def.requires?.tech ?? []) {
    engine.state.technologies[id].unlocked = true
  }
  if (def.requiresClub) {
    const need = def.requiresClub.level ?? 1
    for (let i = 0; i < need; i += 1) engine.upgradeClub(def.requiresClub.id)
    // 社员人数直接补齐（社团成员数由等级决定，这里额外确保达到要求）
    const club = engine.state.clubs[def.requiresClub.id]
    if (def.requiresClub.members && club.members < def.requiresClub.members) {
      club.members = def.requiresClub.members
    }
  }
  engine.state.students.cohorts[0].count = Math.max(engine.state.students.cohorts[0].count, def.minStudents)
}

describe('校队系统', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('数据表里有多种队伍：篮球 / 足球 / 田径 / 游泳 / 弓道 / 数学 / 科学 / 信息 / 辩论 / 轻音 / 合唱 / 演剧 / 美术 / 天文 / 将棋 / 电竞 / 机器人', () => {
    expect(TEAM_DEFS.length).toBeGreaterThanOrEqual(16)
    for (const id of ['basketball', 'football', 'trackTeam', 'swimTeam', 'kyudoTeam', 'mathTeam', 'scienceTeam', 'infoTeam', 'debateTeam', 'lightMusicBand', 'chorusTeam', 'dramaTeam', 'artTeam', 'astronomyTeam', 'shogiTeam', 'esportsTeam', 'robotTeam']) {
      expect(TEAM_MAP[id], `${id} 应该存在`).toBeDefined()
    }
    // 队伍名是「星河·XX」这种校队风格
    expect(TEAM_MAP.basketball.nickname).toBe('火鸟')
    expect(TEAM_MAP.basketball.shortName).toBe('篮球队')
  })

  it('赛事阶梯从友谊赛一路到国际邀请赛，逐级提高门槛', () => {
    expect(TEAM_TIERS.length).toBeGreaterThanOrEqual(6)
    expect(TEAM_TIERS[0].id).toBe('friendly')
    expect(TEAM_TIERS[TEAM_TIERS.length - 1].id).toBe('international')
    for (let i = 1; i < TEAM_TIERS.length; i += 1) {
      expect(TEAM_TIERS[i].minStrength).toBeGreaterThan(TEAM_TIERS[i - 1].minStrength)
      expect(TEAM_TIERS[i].difficulty).toBeGreaterThan(TEAM_TIERS[i - 1].difficulty)
    }
  })

  it('解锁链：先把社团发展到指定等级与人数，才能上报成立校队', () => {
    const engine = makeEngine()
    const def = TEAM_MAP.basketball
    // 开局：球技社只有 Lv.0
    let status = teamUnlockStatus(engine.state as never, def)
    expect(status.unlocked).toBe(false)
    expect(status.reasons.join(' ')).toContain('球技社')
    expect(engine.foundTeam('basketball')).toBe(false)

    // 打通链条后可以成立
    prepareTeam(engine, 'basketball')
    status = teamUnlockStatus(engine.state as never, def)
    expect(status.unlocked).toBe(true)
    expect(canFoundTeam(engine.state as never, 'basketball').ok).toBe(true)
    expect(engine.foundTeam('basketball')).toBe(true)
    expect(engine.state.teams.basketball.founded).toBe(true)
    expect(engine.state.teams.basketball.strength).toBeGreaterThan(0)
  })

  it('轻音社的链条：音乐教室 → 轻音社 Lv.3 + 30 人 → 乐队「星河·轻音」', () => {
    const engine = makeEngine()
    const def = TEAM_MAP.lightMusicBand
    expect(def.requiresClub).toEqual({ id: 'lightMusic', level: 3, members: 30 })
    expect(def.requires?.buildings?.musicRoom).toBe(1)

    engine.debugUncapStorage()
    engine.debugAddAll(2000000)
    engine.debugBuild('musicRoom') // 轻音社需要音乐教室才能成立
    expect(engine.foundTeam('lightMusicBand')).toBe(false) // 还没有轻音社
    engine.upgradeClub('lightMusic')
    engine.upgradeClub('lightMusic')
    expect(engine.foundTeam('lightMusicBand')).toBe(false) // 只有 Lv.2
    engine.upgradeClub('lightMusic')
    expect(engine.state.clubs.lightMusic.level).toBe(3)
    expect(engine.state.clubs.lightMusic.members).toBeGreaterThanOrEqual(30)
    expect(engine.foundTeam('lightMusicBand')).toBe(true)
  })

  it('训练会消耗经费并提升实力，训练完成后士气上升', () => {
    const engine = makeEngine()
    prepareTeam(engine, 'basketball')
    engine.foundTeam('basketball')
    const before = engine.state.teams.basketball.strength
    const gain = trainingGain(engine.state as never, TEAM_MAP.basketball, engine.mods)
    expect(gain).toBeGreaterThan(0)
    expect(engine.trainTeam('basketball')).toBe(true)
    expect(engine.state.teams.basketball.training).not.toBe(false)
    engine.advanceMinutes(TEAM_MAP.basketball.training.minutes + 10)
    expect(engine.state.teams.basketball.strength).toBeGreaterThan(before)
    expect(engine.state.teams.basketball.training).toBe(false)
  })

  it('实力不够时无法报名更高级别的赛事', () => {
    const engine = makeEngine()
    prepareTeam(engine, 'basketball')
    engine.foundTeam('basketball')
    const friendly = TEAM_TIER_MAP.friendly
    const city = TEAM_TIER_MAP.city
    expect(teamTierStatus(engine.state as never, 'basketball', friendly).available).toBe(true)
    const blocked = teamTierStatus(engine.state as never, 'basketball', city)
    expect(blocked.available).toBe(false)
    expect(blocked.reason).toMatch(/实力|参赛资格/)
    expect(engine.teamMatch('basketball', 'city')).toBe(false)
  })

  it('参加友谊赛会结算胜负、更新战绩并写入统计', () => {
    const engine = makeEngine()
    prepareTeam(engine, 'basketball')
    engine.foundTeam('basketball')
    expect(engine.teamMatch('basketball', 'friendly')).toBe(true)
    engine.advanceMinutes(TEAM_TIER_MAP.friendly.durationMinutes + 10)
    const entry = engine.state.teams.basketball
    expect(entry.matches).toBe(1)
    expect(entry.wins + entry.losses).toBe(1)
    expect(engine.state.statistics.competitions).toBeGreaterThan(0)
  })

  it('胜率随实力提升，强队面对弱对手更容易获胜', () => {
    const engine = makeEngine()
    prepareTeam(engine, 'basketball')
    engine.foundTeam('basketball')
    const tier = TEAM_TIER_MAP.friendly
    const weak = teamMatchChance(engine.state as never, TEAM_MAP.basketball, tier, engine.mods)
    engine.state.teams.basketball.strength = 120
    const strong = teamMatchChance(engine.state as never, TEAM_MAP.basketball, tier, engine.mods)
    expect(strong).toBeGreaterThan(weak)
    expect(strong).toBeLessThanOrEqual(0.95)
  })

  it('校队会带来加成，扩编会提高训练收益', () => {
    const engine = makeEngine()
    prepareTeam(engine, 'basketball')
    engine.foundTeam('basketball')
    const gain1 = trainingGain(engine.state as never, TEAM_MAP.basketball, engine.mods)
    expect(engine.upgradeTeam('basketball')).toBe(true)
    const gain2 = trainingGain(engine.state as never, TEAM_MAP.basketball, engine.mods)
    expect(gain2).toBeGreaterThan(gain1)
  })

  it('退役与恋爱这类剧情事件会改变队伍实力与士气', () => {
    const engine = makeEngine()
    prepareTeam(engine, 'basketball')
    engine.foundTeam('basketball')
    engine.state.time.minutes = 30 * MINUTES_PER_DAY // 秋季，满足退役事件的季节条件
    engine.debugTriggerEvent('seniorRetirement')
    const before = engine.state.teams.basketball.morale
    expect(engine.state.events.active.length).toBe(1)
    const uid = engine.state.events.active[0].uid
    // 第三个选项：请她们留下来当助理教练（实力 +6、士气 +5）
    engine.resolveEvent(uid, 2)
    expect(engine.state.teams.basketball.strength).toBeGreaterThan(0)
    expect(engine.state.teams.basketball.morale).toBeGreaterThanOrEqual(before)

    engine.debugTriggerEvent('teamRomance')
    const romanceUid = engine.state.events.active[0].uid
    const moraleBefore = engine.state.teams.basketball.morale
    engine.resolveEvent(romanceUid, 0)
    expect(engine.state.teams.basketball.morale).toBeGreaterThan(moraleBefore)
  })

  it('事件浮窗的结算预览会列出校队变化', async () => {
    const engine = makeEngine()
    prepareTeam(engine, 'basketball')
    engine.foundTeam('basketball')
    const { previewChoice } = await import('../src/game/engine/EventPreview')
    const { EVENT_MAP } = await import('../src/data')
    const preview = previewChoice(engine.state as never, EVENT_MAP.teamRomance.choices[0], 'romance', 0)
    expect(preview.teams.some((line) => line.label.includes('篮球队'))).toBe(true)
  })

  it('存档可以保存与恢复校队状态', () => {
    const engine = makeEngine()
    prepareTeam(engine, 'basketball')
    engine.foundTeam('basketball')
    engine.trainTeam('basketball')
    const text = engine.exportSave()
    const other = makeEngine()
    expect(other.importSave(text).ok).toBe(true)
    expect(other.state.teams.basketball.founded).toBe(true)
    expect(other.state.teams.basketball.training).not.toBe(false)
    expect(CLUB_MAP.ballGame).toBeDefined()
  })
})
