import { computed } from 'vue'

import type {
  AppModePreset,
  WidgetOverride
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useAppModeStore } from '@/stores/appModeStore'
import { resolveNodeWidget } from '@/utils/litegraphUtil'

type WidgetKey = `${string}:${string}`

/** Well-known IDs for built-in presets. */
export const BUILTIN_PRESET_IDS = {
  min: '__builtin:min',
  mid: '__builtin:mid',
  max: '__builtin:max'
} as const

function makeKey(nodeId: string, widgetName: string): WidgetKey {
  return `${nodeId}:${widgetName}`
}

/** Clamp a numeric value to widget override bounds if set. */
function clampToOverride(
  value: unknown,
  override: WidgetOverride | undefined
): unknown {
  if (override === undefined || typeof value !== 'number') return value
  let clamped = value
  if (override.min != null && clamped < override.min) clamped = override.min
  if (override.max != null && clamped > override.max) clamped = override.max
  return clamped
}

/**
 * Resolve effective min/max for a widget: user override > widget options > undefined.
 */
function getEffectiveBounds(
  widgetOptions: { min?: number; max?: number } | undefined,
  override: WidgetOverride | undefined
): { min: number | undefined; max: number | undefined } {
  return {
    min: override?.min ?? widgetOptions?.min,
    max: override?.max ?? widgetOptions?.max
  }
}

function lerp(
  min: number | undefined,
  max: number | undefined,
  t: number
): number | undefined {
  if (min == null || max == null) return undefined
  return min + (max - min) * t
}

export function useAppPresets() {
  const appModeStore = useAppModeStore()

  const presets = computed(() => appModeStore.presets)

  /** Snapshot current widget values for all selected inputs. */
  function snapshotValues(): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const [nodeId, widgetName] of appModeStore.selectedInputs) {
      const [, widget] = resolveNodeWidget(nodeId, widgetName)
      if (widget) {
        values[makeKey(String(nodeId), widgetName)] = widget.value
      }
    }
    return values
  }

  /**
   * Pick an item from a list at interpolation factor t (0=first, 0.5=mid, 1=last).
   */
  function pickFromList(list: unknown[], t: number): unknown {
    if (list.length === 0) return undefined
    const idx = Math.round(t * (list.length - 1))
    return list[idx]
  }

  /**
   * Compute a built-in preset (min/mid/max) from widget bounds.
   * Numeric widgets use min/max interpolation.
   * Combo/list widgets pick from available options by position.
   */
  function computeBuiltinValues(t: number): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const [nodeId, widgetName] of appModeStore.selectedInputs) {
      const key = makeKey(String(nodeId), widgetName)
      const [, widget] = resolveNodeWidget(nodeId, widgetName)
      if (!widget) continue

      // Numeric widgets: interpolate between min and max
      if (typeof widget.value === 'number') {
        const override = appModeStore.widgetOverrides[key]
        const bounds = getEffectiveBounds(widget.options, override)
        const val = lerp(bounds.min, bounds.max, t)
        if (val != null) values[key] = val
        continue
      }

      // Combo/list widgets: pick from options by position
      const opts = widget.options?.values
      if (Array.isArray(opts) && opts.length > 0) {
        values[key] = pickFromList(opts, t)
      }
    }
    return values
  }

  /** Apply a built-in preset by interpolation factor (0=min, 0.5=mid, 1=max). */
  function applyBuiltin(t: number) {
    const values = computeBuiltinValues(t)
    for (const [nodeId, widgetName] of appModeStore.selectedInputs) {
      const key = makeKey(String(nodeId), widgetName)
      if (!(key in values)) continue

      const [, widget] = resolveNodeWidget(nodeId, widgetName)
      if (widget) widget.value = values[key] as typeof widget.value
    }
  }

  function savePreset(name: string): AppModePreset {
    const preset: AppModePreset = {
      id: crypto.randomUUID(),
      name,
      values: snapshotValues()
    }
    appModeStore.presets.push(preset)
    appModeStore.persistLinearData()
    return preset
  }

  function deletePreset(id: string) {
    const idx = appModeStore.presets.findIndex((p) => p.id === id)
    if (idx !== -1) {
      appModeStore.presets.splice(idx, 1)
      appModeStore.persistLinearData()
    }
  }

  function renamePreset(id: string, name: string) {
    const preset = appModeStore.presets.find((p) => p.id === id)
    if (preset) {
      preset.name = name
      appModeStore.persistLinearData()
    }
  }

  /** Apply a preset — sets widget values, clamping to any overrides. */
  function applyPreset(id: string) {
    // Handle built-in presets
    if (id === BUILTIN_PRESET_IDS.min) return applyBuiltin(0)
    if (id === BUILTIN_PRESET_IDS.mid) return applyBuiltin(0.5)
    if (id === BUILTIN_PRESET_IDS.max) return applyBuiltin(1)

    const preset = appModeStore.presets.find((p) => p.id === id)
    if (!preset) return

    for (const [nodeId, widgetName] of appModeStore.selectedInputs) {
      const key = makeKey(String(nodeId), widgetName)
      if (!(key in preset.values)) continue

      const [, widget] = resolveNodeWidget(nodeId, widgetName)
      if (!widget) continue

      const override = appModeStore.widgetOverrides[key]
      const value = clampToOverride(preset.values[key], override)
      widget.value = value as typeof widget.value
    }
  }

  /** Update an existing preset with current widget values. */
  function updatePreset(id: string) {
    const preset = appModeStore.presets.find((p) => p.id === id)
    if (!preset) return

    preset.values = snapshotValues()
    appModeStore.persistLinearData()
  }

  return {
    presets,
    savePreset,
    deletePreset,
    renamePreset,
    applyPreset,
    applyBuiltin,
    updatePreset
  }
}
