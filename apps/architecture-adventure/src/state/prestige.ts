import type { Layer, RunRecord, SaveState } from '@/types'
import { createFreshRun } from '@/state/gameState'

function finalizeRun(save: SaveState, narrativeSummary: string): RunRecord {
  return {
    layer: save.currentRun.layer,
    path: save.currentRun.path,
    challenges: { ...save.currentRun.resolvedChallenges },
    conceptTags: [...save.currentRun.conceptTags],
    insightEarned: save.currentRun.insightEarned,
    narrativeSummary
  }
}

function canPrestige(save: SaveState): boolean {
  return save.persistent.currentLayer < 3
}

function prestige(save: SaveState, narrativeSummary: string): SaveState {
  const record = finalizeRun(save, narrativeSummary)
  const nextLayer = Math.min(save.persistent.currentLayer + 1, 3) as Layer

  return {
    ...save,
    currentRun: createFreshRun(nextLayer),
    history: [...save.history, record],
    persistent: {
      ...save.persistent,
      totalInsight:
        save.persistent.totalInsight + save.currentRun.insightEarned,
      currentLayer: nextLayer
    }
  }
}

export { canPrestige, prestige }
