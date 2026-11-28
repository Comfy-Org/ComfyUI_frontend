import { z } from 'zod'

import { getStorageValue, setStorageValue } from '@/scripts/utils'
import { reportError } from '@comfyorg/telemetry/reportError'
import {
  BrushShape,
  ColorComparisonMethod,
  MaskBlendMode
} from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

const BRUSH_STORAGE_KEY = 'maskeditor_brush_settings'
const TOOL_STORAGE_KEY = 'maskeditor_tool_settings'
const DEFAULT_STEP_SIZE = 5

const storedBrushSchema = z.object({
  type: z.enum(BrushShape),
  size: z.number(),
  opacity: z.number(),
  hardness: z.number(),
  stepSize: z.number().optional()
})

const toolSettingsSchema = z.object({
  rgbColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  maskBlendMode: z.enum(MaskBlendMode),
  maskOpacity: z.number(),
  paintBucketTolerance: z.number(),
  fillOpacity: z.number(),
  colorSelectTolerance: z.number(),
  colorSelectLivePreview: z.boolean(),
  colorComparisonMethod: z.enum(ColorComparisonMethod),
  applyWholeImage: z.boolean(),
  maskBoundary: z.boolean(),
  maskTolerance: z.number(),
  selectionOpacity: z.number()
})

type ToolSettings = z.infer<typeof toolSettingsSchema>

function reportPreferencesFailure(
  cause: unknown,
  errorType:
    | 'error_loading_mask_editor_preferences'
    | 'error_saving_mask_editor_preferences'
): void {
  reportError(cause, {
    errorType,
    surface: 'platform',
    level: 'warning',
    tags: { outcome: 'degraded' }
  })
}

function readStoredJson(key: string): unknown {
  try {
    const stored = getStorageValue(key)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    reportPreferencesFailure(error, 'error_loading_mask_editor_preferences')
    return null
  }
}

export function useMaskEditorPreferences() {
  const store = useMaskEditorStore()

  function currentToolSettings(): ToolSettings {
    return {
      rgbColor: store.rgbColor,
      maskBlendMode: store.maskBlendMode,
      maskOpacity: store.maskOpacity,
      paintBucketTolerance: store.paintBucketTolerance,
      fillOpacity: store.fillOpacity,
      colorSelectTolerance: store.colorSelectTolerance,
      colorSelectLivePreview: store.colorSelectLivePreview,
      colorComparisonMethod: store.colorComparisonMethod,
      applyWholeImage: store.applyWholeImage,
      maskBoundary: store.maskBoundary,
      maskTolerance: store.maskTolerance,
      selectionOpacity: store.selectionOpacity
    }
  }

  function applyToolSettings(settings: ToolSettings): void {
    store.rgbColor = settings.rgbColor
    store.maskBlendMode = settings.maskBlendMode
    store.setMaskOpacity(settings.maskOpacity)
    store.setPaintBucketTolerance(settings.paintBucketTolerance)
    store.setFillOpacity(settings.fillOpacity)
    store.setColorSelectTolerance(settings.colorSelectTolerance)
    store.colorSelectLivePreview = settings.colorSelectLivePreview
    store.colorComparisonMethod = settings.colorComparisonMethod
    store.applyWholeImage = settings.applyWholeImage
    store.maskBoundary = settings.maskBoundary
    store.setMaskTolerance(settings.maskTolerance)
    store.setSelectionOpacity(settings.selectionOpacity)
  }

  function loadBrush(): void {
    const parsed = storedBrushSchema.safeParse(
      readStoredJson(BRUSH_STORAGE_KEY)
    )
    if (!parsed.success) return
    const brush = parsed.data
    store.setBrushSize(brush.size)
    store.setBrushOpacity(brush.opacity)
    store.setBrushHardness(brush.hardness)
    store.brushSettings.type = brush.type
    store.setBrushStepSize(brush.stepSize ?? DEFAULT_STEP_SIZE)
  }

  function loadToolSettings(): void {
    const parsed = toolSettingsSchema
      .partial()
      .safeParse(readStoredJson(TOOL_STORAGE_KEY))
    if (!parsed.success) return
    applyToolSettings({ ...currentToolSettings(), ...parsed.data })
  }

  function loadAndApply(): void {
    loadBrush()
    loadToolSettings()
  }

  function save(): void {
    try {
      setStorageValue(BRUSH_STORAGE_KEY, JSON.stringify(store.brushSettings))
      setStorageValue(TOOL_STORAGE_KEY, JSON.stringify(currentToolSettings()))
    } catch (error) {
      reportPreferencesFailure(error, 'error_saving_mask_editor_preferences')
    }
  }

  return { loadAndApply, save }
}
