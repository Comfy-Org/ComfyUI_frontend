import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

vi.mock('es-toolkit/compat', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    debounce: vi.fn((fn: (...args: unknown[]) => void) => {
      const immediate = (...args: unknown[]) => fn(...args)
      immediate.cancel = vi.fn()
      return immediate
    })
  }
})

vi.mock('@/scripts/utils', () => ({
  getStorageValue: vi.fn((key: string) => localStorage.getItem(key)),
  setStorageValue: vi.fn((key: string, value: string) => {
    localStorage.setItem(key, value)
  })
}))

import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useBrushPersistence } from './useBrushPersistence'

const STORAGE_KEY = 'maskeditor_brush_settings'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  localStorage.clear()
  vi.resetAllMocks()
})

describe('loadAndApply', () => {
  it('does not mutate the store when localStorage is empty', () => {
    const store = useMaskEditorStore()
    const sizeBefore = store.brushSettings.size
    const { loadAndApply } = useBrushPersistence()
    loadAndApply()
    expect(store.brushSettings.size).toBe(sizeBefore)
  })

  it('restores all brush properties from a previous save', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        size: 42,
        opacity: 0.7,
        hardness: 0.3,
        type: 'arc',
        stepSize: 10
      })
    )
    const store = useMaskEditorStore()
    const { loadAndApply } = useBrushPersistence()
    loadAndApply()
    expect(store.brushSettings.size).toBe(42)
    expect(store.brushSettings.opacity).toBe(0.7)
    expect(store.brushSettings.hardness).toBe(0.3)
    expect(store.brushSettings.stepSize).toBe(10)
  })

  it('falls back to stepSize=5 when the field is missing from stored data', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ size: 20, opacity: 0.8, hardness: 0.5, type: 'arc' })
    )
    const store = useMaskEditorStore()
    const { loadAndApply } = useBrushPersistence()
    loadAndApply()
    expect(store.brushSettings.stepSize).toBe(5)
  })

  it('does not throw on corrupted localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json')
    const { loadAndApply } = useBrushPersistence()
    expect(() => loadAndApply()).not.toThrow()
  })
})

describe('save', () => {
  it('writes current brush settings to localStorage', () => {
    const store = useMaskEditorStore()
    store.brushSettings.size = 99
    const { save } = useBrushPersistence()
    save()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(saved.size).toBe(99)
  })
})
