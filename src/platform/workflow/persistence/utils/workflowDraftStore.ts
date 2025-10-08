const WORKFLOW_DRAFTS_KEY = 'Comfy.Workflow.Drafts'
const WORKFLOW_DRAFT_ORDER_KEY = 'Comfy.Workflow.DraftOrder'
const MAX_WORKFLOW_DRAFTS = 32

interface WorkflowDraftSnapshot {
  data: string
  updatedAt: number
  name: string
  isTemporary: boolean
}

interface DraftStore {
  drafts: Record<string, WorkflowDraftSnapshot>
  order: string[]
}

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    console.warn(`Failed to parse ${key} from localStorage`, err)
    return fallback
  }
}

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value))
}

const readStore = (): DraftStore => ({
  drafts: readJson<Record<string, WorkflowDraftSnapshot>>(
    WORKFLOW_DRAFTS_KEY,
    {}
  ),
  order: readJson<string[]>(WORKFLOW_DRAFT_ORDER_KEY, [])
})

const persistStore = (store: DraftStore) => {
  writeJson(WORKFLOW_DRAFTS_KEY, store.drafts)
  writeJson(WORKFLOW_DRAFT_ORDER_KEY, store.order)
}

export const readDraft = (path: string): WorkflowDraftSnapshot | undefined =>
  readStore().drafts[path]

export const readMostRecentDraftPath = (): string | null => {
  const { order } = readStore()
  return order.length ? order[order.length - 1] : null
}

export const writeDraft = (path: string, snapshot: WorkflowDraftSnapshot) => {
  const store = readStore()
  store.drafts[path] = snapshot
  store.order = store.order.filter((entry) => entry !== path)
  store.order.push(path)

  while (store.order.length > MAX_WORKFLOW_DRAFTS) {
    const oldest = store.order.shift()
    if (!oldest) continue
    delete store.drafts[oldest]
  }

  persistStore(store)
}

export const clearDraft = (path: string) => {
  const store = readStore()
  if (!(path in store.drafts)) return
  delete store.drafts[path]
  store.order = store.order.filter((entry) => entry !== path)
  persistStore(store)
}

export const createDraftSnapshot = (
  json: unknown,
  name: string,
  isTemporary: boolean
): WorkflowDraftSnapshot => ({
  data: JSON.stringify(json),
  updatedAt: Date.now(),
  name,
  isTemporary
})
