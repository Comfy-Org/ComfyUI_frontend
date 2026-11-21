import { describe, expect, it, vi } from 'vitest'

vi.mock(import('@/scripts/utils'), () => ({
  getStorageValue: vi.fn((key: string) => localStorage.getItem(key)),
  setStorageValue: vi.fn((key: string, value: string) => {
    localStorage.setItem(key, value)
  })
}))

import { reportError } from '@comfyorg/telemetry/reportError'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import {
  ColorComparisonMethod,
  MaskBlendMode
} from '@comfyorg/mask-editor/types'
import { useMaskEditorPreferences } from './useMaskEditorPreferences'

const BRUSH_STORAGE_KEY = 'maskeditor_brush_settings'
const TOOL_STORAGE_KEY = 'maskeditor_tool_settings'

describe('loadAndApply', () => {
  it('does not mutate the store when localStorage is empty', () => {
    const store = useMaskEditorStore()
    const sizeBefore = store.brushSettings.size
    const { loadAndApply } = useMaskEditorPreferences()
    loadAndApply()
    expect(store.brushSettings.size).toBe(sizeBefore)
  })

  it('restores all brush properties from a previous save', () => {
    localStorage.setItem(
      BRUSH_STORAGE_KEY,
      JSON.stringify({
        size: 42,
        opacity: 0.7,
        hardness: 0.3,
        type: 'arc',
        stepSize: 10
      })
    )
    const store = useMaskEditorStore()
    const { loadAndApply } = useMaskEditorPreferences()
    loadAndApply()
    expect(store.brushSettings.size).toBe(42)
    expect(store.brushSettings.opacity).toBe(0.7)
    expect(store.brushSettings.hardness).toBe(0.3)
    expect(store.brushSettings.stepSize).toBe(10)
  })

  it('falls back to stepSize=5 when the field is missing from stored data', () => {
    localStorage.setItem(
      BRUSH_STORAGE_KEY,
      JSON.stringify({ size: 20, opacity: 0.8, hardness: 0.5, type: 'arc' })
    )
    const store = useMaskEditorStore()
    const { loadAndApply } = useMaskEditorPreferences()
    loadAndApply()
    expect(store.brushSettings.stepSize).toBe(5)
  })

  it('keeps the current brush and reports corrupted localStorage data', () => {
    localStorage.setItem(BRUSH_STORAGE_KEY, 'not-valid-json')
    const store = useMaskEditorStore()
    const sizeBefore = store.brushSettings.size
    const { loadAndApply } = useMaskEditorPreferences()

    loadAndApply()

    expect(store.brushSettings.size).toBe(sizeBefore)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(SyntaxError),
      expect.objectContaining({
        errorType: 'error_loading_mask_editor_preferences'
      })
    )
  })
})

describe('save', () => {
  it('writes the settings at call time without waiting for a timer', () => {
    const store = useMaskEditorStore()
    store.setBrushSize(300)
    const { save } = useMaskEditorPreferences()
    save()
    store.setBrushSize(10)

    const saved = JSON.parse(localStorage.getItem(BRUSH_STORAGE_KEY) ?? '{}')
    expect(saved.size).toBe(250)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('tool settings', () => {
  it('restores tool settings when the editor is reopened right after closing', () => {
    const store = useMaskEditorStore()
    store.rgbColor = '#00FF00'
    store.maskBlendMode = MaskBlendMode.White
    store.setMaskOpacity(0.5)
    store.setPaintBucketTolerance(40)
    store.setFillOpacity(60)
    store.setColorSelectTolerance(90)
    store.colorSelectLivePreview = true
    store.colorComparisonMethod = ColorComparisonMethod.LAB
    store.applyWholeImage = true
    store.maskBoundary = true
    store.setMaskTolerance(12)
    store.setSelectionOpacity(30)
    const { save, loadAndApply } = useMaskEditorPreferences()

    save()
    store.resetState()
    loadAndApply()

    expect(store).toMatchObject({
      rgbColor: '#00FF00',
      maskBlendMode: MaskBlendMode.White,
      maskOpacity: 0.5,
      paintBucketTolerance: 40,
      fillOpacity: 60,
      colorSelectTolerance: 90,
      colorSelectLivePreview: true,
      colorComparisonMethod: ColorComparisonMethod.LAB,
      applyWholeImage: true,
      maskBoundary: true,
      maskTolerance: 12,
      selectionOpacity: 30
    })
  })

  it('keeps defaults for tool settings missing from an older save', () => {
    localStorage.setItem(
      TOOL_STORAGE_KEY,
      JSON.stringify({ paintBucketTolerance: 40 })
    )
    const store = useMaskEditorStore()
    const { loadAndApply } = useMaskEditorPreferences()

    loadAndApply()

    expect(store).toMatchObject({
      paintBucketTolerance: 40,
      fillOpacity: 100,
      maskBlendMode: MaskBlendMode.Black
    })
  })

  it('ignores stored tool settings that contain an invalid value', () => {
    localStorage.setItem(
      TOOL_STORAGE_KEY,
      JSON.stringify({ paintBucketTolerance: 40, maskBlendMode: 'purple' })
    )
    const store = useMaskEditorStore()
    const { loadAndApply } = useMaskEditorPreferences()

    loadAndApply()

    expect(store).toMatchObject({
      paintBucketTolerance: 5,
      maskBlendMode: MaskBlendMode.Black
    })
  })
})
