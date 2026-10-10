import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDefaultFixture } from '@e2e/fixtures/components/WidgetSelectDefault'
import {
  routeObjectInfoFromSetupApi,
  setComboInputOptions
} from '@e2e/fixtures/utils/objectInfo'

const FOLDERS = [
  'flux/realism',
  'flux/styles',
  'hunyuan/video',
  'illustrious/artists',
  'pony/characters',
  'pony/poses',
  'sd15/anime',
  'sd15/realistic',
  'sdxl/characters',
  'sdxl/clothing',
  'sdxl/concepts',
  'sdxl/styles',
  'wan2.1/motion'
]
const ADJECTIVES = [
  'detailed',
  'cinematic',
  'soft',
  'neon',
  'vintage',
  'glossy',
  'painterly',
  'gritty',
  'pastel',
  'dreamy'
]
const NOUNS = [
  'portrait',
  'lighting',
  'armor',
  'landscape',
  'eyes',
  'hands',
  'fabric',
  'city',
  'forest',
  'robot',
  'dress'
]

export const LORA_COUNT = 10_000
export const FIRST_LORA = 'My Character LoRA (final).safetensors'
export const DEEP_LORA = 'sdxl/styles/zz_deep_target_v1.safetensors'
export const LONG_LORA = `sdxl/styles/${'extremely_long_descriptive_lora_name_'.repeat(6)}v12.safetensors`
export const SEARCH_HITS = [
  'sd15/anime/hatsune_miku_lowres.safetensors',
  'sdxl/characters/hatsune_miku_v2.safetensors',
  'sdxl/characters/hatsune_miku_v3.safetensors'
]

const EXPLICIT = [FIRST_LORA, DEEP_LORA, LONG_LORA, ...SEARCH_HITS]

function generatedName(i: number) {
  const folder = FOLDERS[i % FOLDERS.length]
  const adjective = ADJECTIVES[(i * 7) % ADJECTIVES.length]
  const noun = NOUNS[(i * 3) % NOUNS.length]
  const epoch = i % 9 === 0 ? `-${String(i % 40).padStart(6, '0')}` : ''
  return `${folder}/${adjective}_${noun}_${i.toString(36)}_v${(i % 5) + 1}${epoch}.safetensors`
}

export const LORA_NAMES = [
  ...EXPLICIT,
  ...Array.from({ length: LORA_COUNT - EXPLICIT.length }, (_, i) =>
    generatedName(i)
  )
].sort()

export const largeLoraComboTest = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) =>
        setComboInputOptions(objectInfo, 'LoraLoader', 'lora_name', LORA_NAMES)
    )
    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

export function loraCombo(comfyPage: ComfyPage, nodeTitle: string) {
  return new WidgetSelectDefaultFixture(
    comfyPage.vueNodes.getNodeByTitle(nodeTitle),
    'lora_name'
  )
}
