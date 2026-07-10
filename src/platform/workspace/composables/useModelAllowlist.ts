import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

export interface AllowlistModel {
  id: string
  /** Catalog display_name — format varies by source (see mock rows). */
  displayName: string
  type: string
  lastModified: string | null
  enabled: boolean
}

type SortField = 'name' | 'type' | 'lastModified'
type SortDirection = 'asc' | 'desc'

// Prototype mock: there is no model-allowlist endpoint yet. Rows are real
// entries from the models catalog, deliberately mixed by source so the design
// confronts the real display_name formats: HuggingFace "owner/repo - file",
// friendly Civitai titles (including very long and CJK ones), and the
// filename-derived fallback used when enrichment is missing.
const MOCK_MODELS: AllowlistModel[] = [
  ['Comfy-Org/ACE-Step_ComfyUI_repackaged - ace_step_v1_3.5b', 'Checkpoint'],
  ['512 inpainting ema', 'Checkpoint'],
  [
    'Comfy-Org/ace_step_1.5_ComfyUI_files - acestep_v1.5_turbo',
    'Diffusion model'
  ],
  ['circlestone-labs/Anima - anima-preview', 'Diffusion model'],
  ['Comfy-Org/HunyuanVideo_1.5_repackaged - capybara_v0.1', 'Diffusion model'],
  ['lilylilith/AnyPose - 2511-AnyPose-base-000006250', 'LoRA'],
  ['lilylilith/AnyPose - 2511-AnyPose-helper-00006000', 'LoRA'],
  ['Kim2091/UltraSharp - 4x-UltraSharp', 'Upscaler'],
  ['Kim2091/ClearRealityV1 - 4x-ClearRealityV1', 'Upscaler'],
  ['8x_NMKD-Faces_160000_G Upscaler', 'Upscaler'],
  ['yuvraj108c/ComfyUI-Upscaler-Onnx - 4x-AnimeSharp', 'ONNX'],
  ['Comfy-Org/HiDream-I1_ComfyUI - ae', 'VAE'],
  ['Kijai/CogVideoX-Fun-pruned - cogvideox_vae', 'VAE'],
  ['Lightricks/LTX-2.3-fp8 - ltx-2.3-22b-dev-fp8', 'Checkpoint'],
  ['Comfy-Org/Qwen-Image_ComfyUI - qwen_2.5_vl_7b_fp8_scaled', 'Text encoder'],
  ['qwen 3 8b', 'Text encoder'],
  ['DreamShaper', 'Checkpoint'],
  ['Western Toon Style', 'LoRA'],
  [
    'Dream Creation Virtual 3D | E-commerce Scene Key Visual Poster | Blind Box IP Display C4D Super Visual',
    'Checkpoint'
  ],
  ['blindbox/大概是盲盒', 'LoRA'],
  ['ControlNet T2I-Adapter Models', 'ControlNet'],
  ['Comfy-Org/ace_step_1.5_ComfyUI_files - qwen_0.6b_ace15', 'Text encoder'],
  ['Comfy-Org/ace_step_1.5_ComfyUI_files - qwen_1.7b_ace15', 'Text encoder'],
  ['Comfy-Org/HunyuanVideo_1.5_repackaged - qwen_2.5_vl_7b', 'Text encoder'],
  ['Comfy-Org/Omnigen2_ComfyUI_repackaged - qwen_2.5_vl_fp16', 'Text encoder'],
  ['circlestone-labs/Anima - qwen_3_06b_base', 'Text encoder'],
  ['Comfy-Org/z_image_turbo - qwen_3_4b', 'Text encoder'],
  ['qwen 3 4b fp4 flux2', 'Text encoder'],
  [
    'Comfy-Org/vae-text-encorder-for-flux-klein-9b - qwen_3_8b_fp4mixed',
    'Text encoder'
  ],
  ['Comfy-Org/ace_step_1.5_ComfyUI_files - ace_1.5_vae', 'VAE'],
  [
    'TheDenk/cogvideox-2b-controlnet-canny-v1 - diffusion_pytorch_model',
    'ControlNet'
  ],
  ['TheDenk/cogvideox-2b-controlnet-hed-v1 - config', 'ControlNet'],
  ['yuvraj108c/ComfyUI-Upscaler-Onnx - 4x-ClearRealityV1', 'ONNX'],
  ['yuvraj108c/ComfyUI-Upscaler-Onnx - 4x-UltraSharp', 'ONNX'],
  ['yuvraj108c/ComfyUI-Upscaler-Onnx - 4x-UltraSharpV2_Lite', 'ONNX'],
  ['2000s Analog Core', 'LoRA'],
  ['80s Fantasy Movie', 'LoRA'],
  ["zyd232's Ink Style", 'LoRA'],
  ['YFG ChatGPT 4o Style [Flux | ZIT]', 'LoRA'],
  [
    'Z Image Turbo / Flux - Realistic Water Droplets (Wet Effect) - By Devildonia',
    'LoRA'
  ],
  ['ArchitectureRealMix', 'Checkpoint'],
  ['AWPainting', 'Checkpoint'],
  ['CarDos Anime', 'Checkpoint'],
  [
    'FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI - FireRed-Image-Edit-1.1-transformer',
    'Diffusion model'
  ],
  [
    'FireRedTeam/FireRed-Image-Edit-1.0-ComfyUI - FireRed-Image-Edit-1.0-Lightning-8steps-v1.0',
    'LoRA'
  ],
  ['Comfy-Org/ltx-2 - gemma-3-12b-it-abliterated_lora_rank64_bf16', 'LoRA'],
  ['dx8152/Flux2-Klein-9B-Consistency - Klein-consistency', 'LoRA'],
  ['fal/virtual-tryoff-lora - virtual-tryoff-lora_comfy', 'LoRA'],
  ['TheDenk/cogvideox-2b-controlnet-canny-v1 - config', 'ControlNet']
].map(([displayName, type], i) => ({
  id: `model-${i}`,
  displayName,
  type,
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

  const selectedCount = computed(() => selectedIds.value.size)
  const allFilteredSelected = computed(
    () =>
      filteredModels.value.length > 0 &&
      filteredModels.value.every((m) => selectedIds.value.has(m.id))
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

  function setAutoEnableNew(value: boolean) {
    autoEnableNew.value = value
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function toggleSelectAll() {
    if (allFilteredSelected.value) {
      clearSelection()
      return
    }
    selectedIds.value = new Set(filteredModels.value.map((m) => m.id))
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
    allFilteredSelected,
    filteredModels,
    page,
    total,
    itemsPerPage: perPage,
    pagedModels,
    toggleSort,
    setEnabled,
    setSelectedEnabled,
    setAutoEnableNew,
    toggleSelection,
    toggleSelectAll,
    clearSelection
  }
}
