import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useLegacySearchTip } from './useLegacySearchTip'

function tipFor(
  searchedQuery: string,
  { rawResultsEmpty = true, isNewManagerUI = true } = {}
) {
  return useLegacySearchTip(
    ref(searchedQuery),
    ref(isNewManagerUI),
    ref(rawResultsEmpty)
  ).isUnmatchedLegacyManagerSearch.value
}

describe('useLegacySearchTip', () => {
  it.for([
    'comfyui-manager',
    'ComfyUI-Manager',
    '  comfyui-manager  ',
    'comfyui manager',
    'manager comfyui',
    'ltdrdata/ComfyUI-Manager',
    'Comfy-Org/comfyui-manager',
    'ltdrdata/comfyui-manager.git',
    'https://github.com/ltdrdata/ComfyUI-Manager',
    'https://github.com/Comfy-Org/ComfyUI-Manager.git',
    'github.com/ltdrdata/ComfyUI-Manager/tree/main'
  ])('shows the tip for %j when its raw query found nothing', (query) => {
    expect(tipFor(query)).toBe(true)
  })

  it.for([
    'willmiao/comfyui-lora-manager',
    'comfyui-lora-manager',
    'model-manager',
    'comfyui-model-manager',
    'workspace-manager',
    'comfyui-manager-extras',
    'where is comfyui-manager',
    'manager',
    'controlnet',
    '',
    '   '
  ])('hides the tip for %j', (query) => {
    expect(tipFor(query)).toBe(false)
  })

  it('hides the tip when the raw query found packs', () => {
    expect(tipFor('comfyui-manager', { rawResultsEmpty: false })).toBe(false)
  })

  it('hides the tip in the legacy manager UI', () => {
    expect(tipFor('comfyui-manager', { isNewManagerUI: false })).toBe(false)
  })

  it('follows the searched query as each search completes', () => {
    const searchedQuery = ref('comfyui-manager')
    const { isUnmatchedLegacyManagerSearch } = useLegacySearchTip(
      searchedQuery,
      ref(true),
      ref(true)
    )
    expect(isUnmatchedLegacyManagerSearch.value).toBe(true)

    searchedQuery.value = 'willmiao/comfyui-lora-manager'

    expect(isUnmatchedLegacyManagerSearch.value).toBe(false)
  })
})
