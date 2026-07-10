import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

import modelCatalog from '@/platform/workspace/composables/modelAllowlist.data.json' with { type: 'json' }

export interface AllowlistModel {
  id: string
  /** Catalog display_name — format varies by source (see mock rows). */
  displayName: string
  type: string
  lastModified: string | null
  enabled: boolean
}

// Catalog `type` values → display labels; unknown types fall back to a
// capitalized, de-underscored form.
const TYPE_LABELS: Record<string, string> = {
  checkpoint: 'Checkpoint',
  lora: 'LoRA',
  vae: 'VAE',
  vae_approx: 'VAE approx',
  controlnet: 'ControlNet',
  upscaler: 'Upscaler',
  onnx: 'ONNX',
  text_encoder: 'Text encoder',
  diffusion_model: 'Diffusion model',
  clip: 'CLIP',
  clip_vision: 'CLIP vision',
  embedding: 'Embedding',
  llm: 'LLM',
  tts: 'TTS',
  sam: 'SAM',
  sam3d: 'SAM 3D',
  sam3dbody: 'SAM 3D body',
  ip_adapter: 'IP-Adapter',
  animatediff: 'AnimateDiff',
  flashvsr: 'FlashVSR',
  'flashvsr-v1.1': 'FlashVSR v1.1',
  cogvideo: 'CogVideo',
  gligen: 'GLIGEN',
  nlf: 'NLF',
  '3d': '3D'
}

function typeLabel(type: string): string {
  const label = TYPE_LABELS[type]
  if (label) return label
  const words = type.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

type SortField = 'name' | 'type' | 'lastModified'
type SortDirection = 'asc' | 'desc'

// Prototype mock: there is no model-allowlist endpoint yet. The rows are the
// FULL models catalog (harvested 2026-07-09 via the catalog API, ~1,382
// entries) so the tab exercises real scale and the real display_name formats:
// HuggingFace "owner/repo - file", friendly Civitai titles (including very
// long and CJK ones), and filename-derived fallbacks.
const MOCK_MODELS: AllowlistModel[] = (
  modelCatalog as { name: string; type: string }[]
).map(({ name, type }, i) => ({
  id: `model-${i}`,
  displayName: name,
  type: typeLabel(type),
  lastModified: null,
  enabled: true
}))

// Two rows start disabled + dated for state coverage.
MOCK_MODELS[3] = {
  ...MOCK_MODELS[3],
  enabled: false,
  lastModified: '2026-08-01T00:00:00Z'
}
MOCK_MODELS[5] = {
  ...MOCK_MODELS[5],
  enabled: false,
  lastModified: '2026-08-08T00:00:00Z'
}

function compareModels(
  a: AllowlistModel,
  b: AllowlistModel,
  field: SortField,
  direction: SortDirection
): number {
  const dir = direction === 'asc' ? 1 : -1
  if (field === 'lastModified') {
    return (a.lastModified ?? '').localeCompare(b.lastModified ?? '') * dir
  }
  const key = field === 'type' ? 'type' : 'displayName'
  return a[key].localeCompare(b[key]) * dir
}

export function useModelAllowlist(pageSize: MaybeRefOrGetter<number>) {
  const models = ref<AllowlistModel[]>(MOCK_MODELS.map((m) => ({ ...m })))
  const autoEnableNew = ref(true)

  const searchQuery = ref('')
  const sortField = ref<SortField>('name')
  const sortDirection = ref<SortDirection>('asc')
  const selectedIds = ref<Set<string>>(new Set())

  const filteredModels = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    const filtered = models.value.filter(
      (m) =>
        !q ||
        m.displayName.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q)
    )
    return filtered.sort((a, b) =>
      compareModels(a, b, sortField.value, sortDirection.value)
    )
  })

  // The real catalog is ~1,400 models behind a limit/offset endpoint, so the
  // list is paginated rather than scrolled; page size tracks the dialog height.
  const page = ref(1)
  const perPage = computed(() => Math.max(1, toValue(pageSize)))
  const total = computed(() => filteredModels.value.length)
  const pagedModels = computed(() => {
    const start = (page.value - 1) * perPage.value
    return filteredModels.value.slice(start, start + perPage.value)
  })

  watch([total, perPage], ([count]) => {
    const lastPage = Math.max(1, Math.ceil(count / perPage.value))
    if (page.value > lastPage) page.value = lastPage
  })

  // A new query re-queries from the start — matching the eventual offset-0
  // server request — rather than stranding the user mid-way into new results.
  watch(searchQuery, () => {
    page.value = 1
  })

  const selectedCount = computed(() => selectedIds.value.size)
  // The header checkbox works page-by-page: selecting 1,400 rows in one click
  // is a different action (Enable/Disable all) than building a selection.
  const allPageSelected = computed(
    () =>
      pagedModels.value.length > 0 &&
      pagedModels.value.every((m) => selectedIds.value.has(m.id))
  )

  function toggleSort(field: SortField) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'asc'
    }
  }

  function applyEnabled(ids: string[], enabled: boolean) {
    const idSet = new Set(ids)
    const now = new Date().toISOString()
    models.value = models.value.map((m) =>
      idSet.has(m.id) ? { ...m, enabled, lastModified: now } : m
    )
  }

  function setEnabled(model: AllowlistModel, enabled: boolean) {
    applyEnabled([model.id], enabled)
  }

  function setSelectedEnabled(enabled: boolean) {
    applyEnabled([...selectedIds.value], enabled)
  }

  // Acts on the filtered set, so a search narrows the blast radius (e.g.
  // search "tts" → Disable all). Maps onto the eventual server-side
  // bulk-by-query operation.
  function setAllFilteredEnabled(enabled: boolean) {
    applyEnabled(
      filteredModels.value.map((m) => m.id),
      enabled
    )
  }

  function setAutoEnableNew(value: boolean) {
    autoEnableNew.value = value
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function toggleSelectAllPage() {
    const next = new Set(selectedIds.value)
    if (allPageSelected.value) {
      for (const m of pagedModels.value) next.delete(m.id)
    } else {
      for (const m of pagedModels.value) next.add(m.id)
    }
    selectedIds.value = next
  }

  function clearSelection() {
    selectedIds.value = new Set()
  }

  return {
    autoEnableNew,
    searchQuery,
    sortField,
    sortDirection,
    selectedIds,
    selectedCount,
    allPageSelected,
    filteredModels,
    page,
    total,
    itemsPerPage: perPage,
    pagedModels,
    toggleSort,
    setEnabled,
    setSelectedEnabled,
    setAllFilteredEnabled,
    setAutoEnableNew,
    toggleSelection,
    toggleSelectAllPage,
    clearSelection
  }
}
