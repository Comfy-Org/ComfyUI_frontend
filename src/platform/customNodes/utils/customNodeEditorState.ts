const STORAGE_PREFIX = 'Comfy.CustomNodeEditorState.v1:'
const STORAGE_VERSION = 1
const MAX_STORED_PACKS = 50
const MAX_OPENED_PATHS = 20
const MAX_PATH_LENGTH = 240
const MIN_EXPLORER_WIDTH = 180
const MAX_EXPLORER_WIDTH = 640

export interface CustomNodeEditorState {
  version: typeof STORAGE_VERSION
  updatedAt: number
  activePath?: string
  openedPaths?: string[]
  explorerOpen?: boolean
  explorerWidth?: number
  agentOpen?: boolean
}

export type CustomNodeEditorStatePatch = Omit<
  Partial<CustomNodeEditorState>,
  'version' | 'updatedAt'
>

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_PATH_LENGTH &&
    !value.includes('\\') &&
    !value.startsWith('/') &&
    !value.split('/').includes('..')
  )
}

function sanitizeState(value: unknown): CustomNodeEditorState | null {
  if (
    !isRecord(value) ||
    value.version !== STORAGE_VERSION ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt)
  ) {
    return null
  }

  const state: CustomNodeEditorState = {
    version: STORAGE_VERSION,
    updatedAt: value.updatedAt
  }
  if (validPath(value.activePath)) state.activePath = value.activePath
  if (Array.isArray(value.openedPaths)) {
    state.openedPaths = [
      ...new Set(value.openedPaths.filter(validPath).slice(0, MAX_OPENED_PATHS))
    ]
  }
  if (typeof value.explorerOpen === 'boolean') {
    state.explorerOpen = value.explorerOpen
  }
  if (
    typeof value.explorerWidth === 'number' &&
    Number.isFinite(value.explorerWidth)
  ) {
    state.explorerWidth = Math.min(
      MAX_EXPLORER_WIDTH,
      Math.max(MIN_EXPLORER_WIDTH, Math.round(value.explorerWidth))
    )
  }
  if (typeof value.agentOpen === 'boolean') state.agentOpen = value.agentOpen
  return state
}

function pruneOldStates(storage: Storage) {
  const entries: Array<{ key: string; updatedAt: number }> = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key?.startsWith(STORAGE_PREFIX)) continue
    const state = readCustomNodeEditorState(key)
    entries.push({ key, updatedAt: state?.updatedAt ?? 0 })
  }
  entries
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(MAX_STORED_PACKS)
    .forEach(({ key }) => storage.removeItem(key))
}

export function customNodeEditorStateKey(
  workspaceId: string | null | undefined,
  packName: string
): string {
  const workspace = workspaceId?.trim() || 'personal'
  const pack = packName.trim() || 'untitled'
  return `${STORAGE_PREFIX}${encodeURIComponent(workspace)}:${encodeURIComponent(pack)}`
}

export function readCustomNodeEditorState(
  key: string
): CustomNodeEditorState | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    const serialized = storage.getItem(key)
    return serialized ? sanitizeState(JSON.parse(serialized)) : null
  } catch {
    return null
  }
}

export function updateCustomNodeEditorState(
  key: string,
  patch: CustomNodeEditorStatePatch
): void {
  const storage = getStorage()
  if (!storage) return
  try {
    const previous = readCustomNodeEditorState(key)
    const next = sanitizeState({
      ...previous,
      ...patch,
      version: STORAGE_VERSION,
      updatedAt: Date.now()
    })
    if (!next) return
    storage.setItem(key, JSON.stringify(next))
    pruneOldStates(storage)
  } catch {
    // Editor state is optional and must never block node authoring.
  }
}

export function migrateCustomNodeEditorState(
  previousKey: string,
  nextKey: string
): void {
  if (previousKey === nextKey) return
  const storage = getStorage()
  if (!storage) return
  try {
    const previous = readCustomNodeEditorState(previousKey)
    if (previous) {
      updateCustomNodeEditorState(nextKey, previous)
      storage.removeItem(previousKey)
    }
  } catch {
    // A failed preference migration is safe to ignore.
  }
}
