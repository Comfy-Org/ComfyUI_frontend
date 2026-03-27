import type { CurrentRun, Layer, SaveState } from '@/types'

const STORAGE_KEY = 'codebase-caverns-v2'
const SAVE_VERSION = 1

function createFreshRun(layer: Layer): CurrentRun {
  return {
    layer,
    path: [],
    resolvedChallenges: {},
    conceptTags: [],
    insightEarned: 0,
    currentRoom: 'entry'
  }
}

function createDefaultSave(): SaveState {
  return {
    version: SAVE_VERSION,
    currentRun: createFreshRun(1),
    history: [],
    persistent: {
      totalInsight: 0,
      currentLayer: 1,
      achievements: []
    }
  }
}

function loadSave(): SaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultSave()

    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      (parsed as SaveState).version === SAVE_VERSION
    ) {
      return parsed as SaveState
    }
    return createDefaultSave()
  } catch {
    return createDefaultSave()
  }
}

function persistSave(save: SaveState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
}

function clearSave(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function isV1Save(): boolean {
  try {
    const raw = localStorage.getItem('codebase-caverns')
    return raw !== null
  } catch {
    return false
  }
}

export {
  clearSave,
  createDefaultSave,
  createFreshRun,
  isV1Save,
  loadSave,
  persistSave,
  SAVE_VERSION
}
