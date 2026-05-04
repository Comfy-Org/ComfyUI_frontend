import { debounce } from 'es-toolkit/compat'

import { getStorageValue, setStorageValue } from '@/scripts/utils'
import type { Brush } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const STORAGE_KEY = 'maskeditor_brush_settings'

function loadBrushFromStorage(): Brush | null {
  try {
    const brushString = getStorageValue(STORAGE_KEY)
    if (brushString) {
      return JSON.parse(brushString) as Brush
    }
    return null
  } catch (error) {
    console.error('Failed to load brush from cache:', error)
    return null
  }
}

const debouncedWrite = debounce((serialized: string): void => {
  try {
    setStorageValue(STORAGE_KEY, serialized)
  } catch (error) {
    console.error('Failed to save brush to cache:', error)
  }
}, 300)

export function useBrushPersistence() {
  const store = useMaskEditorStore()

  function save(): void {
    debouncedWrite(JSON.stringify(store.brushSettings))
  }

  function loadAndApply(): void {
    const cached = loadBrushFromStorage()
    if (!cached) return
    store.setBrushSize(cached.size)
    store.setBrushOpacity(cached.opacity)
    store.setBrushHardness(cached.hardness)
    store.brushSettings.type = cached.type
    store.setBrushStepSize(cached.stepSize ?? 5)
  }

  return { loadAndApply, save }
}
