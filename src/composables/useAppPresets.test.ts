import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

const mockWidgets = vi.hoisted(() => new Map<string, IBaseWidget>())

vi.mock('@/utils/litegraphUtil', () => ({
  resolveNodeWidget: (nodeId: NodeId, widgetName: string) => {
    const widget = mockWidgets.get(`${nodeId}:${widgetName}`)
    return widget ? [{}, widget] : []
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { extra: {}, nodes: [{ id: 1 }] }
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({ read_only: false })
  })
}))

vi.mock('@/components/builder/useEmptyWorkflowDialog', () => ({
  useEmptyWorkflowDialog: () => ({ show: vi.fn() })
}))

vi.mock('@/scripts/changeTracker', () => ({
  ChangeTracker: { isLoadingGraph: false }
}))

import { useAppModeStore } from '@/stores/appModeStore'
import { useAppPresets } from './useAppPresets'

function createWidget(
  name: string,
  value: unknown,
  options?: Record<string, unknown>
): IBaseWidget {
  return { name, value, type: 'number', options } as unknown as IBaseWidget
}

describe('useAppPresets', () => {
  let appModeStore: ReturnType<typeof useAppModeStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    appModeStore = useAppModeStore()
    mockWidgets.clear()
  })

  describe('savePreset', () => {
    it('snapshots current widget values and saves with a name', () => {
      const widget = createWidget('steps', 20)
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { savePreset, presets } = useAppPresets()
      const preset = savePreset('My Preset')

      expect(preset.name).toBe('My Preset')
      expect(preset.values['1:steps']).toBe(20)
      expect(presets.value).toHaveLength(1)
    })

    it('saves multiple widget values', () => {
      mockWidgets.set('1:steps', createWidget('steps', 20))
      mockWidgets.set('2:cfg', createWidget('cfg', 7.5))
      appModeStore.selectedInputs.push(
        ['1' as NodeId, 'steps'],
        ['2' as NodeId, 'cfg']
      )

      const { savePreset } = useAppPresets()
      const preset = savePreset('Dual')

      expect(preset.values['1:steps']).toBe(20)
      expect(preset.values['2:cfg']).toBe(7.5)
    })
  })

  describe('applyPreset', () => {
    it('sets widget values from the preset', () => {
      const widget = createWidget('steps', 20)
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { savePreset, applyPreset } = useAppPresets()
      const preset = savePreset('Saved')

      widget.value = 50

      applyPreset(preset.id)
      expect(widget.value).toBe(20)
    })

    it('clamps numeric values to widget overrides', () => {
      const widget = createWidget('steps', 25)
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])
      appModeStore.widgetOverrides['1:steps'] = { min: 10, max: 30 }

      const { savePreset, applyPreset } = useAppPresets()
      const preset = savePreset('High Steps')

      // Manually override the preset value to be out of range
      preset.values['1:steps'] = 50

      applyPreset(preset.id)
      expect(widget.value).toBe(30)
    })

    it('clamps to min override', () => {
      const widget = createWidget('steps', 5)
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])
      appModeStore.widgetOverrides['1:steps'] = { min: 10 }

      const { savePreset, applyPreset } = useAppPresets()
      const preset = savePreset('Low Steps')
      preset.values['1:steps'] = 2

      applyPreset(preset.id)
      expect(widget.value).toBe(10)
    })

    it('does not clamp non-numeric values', () => {
      const widget = createWidget('sampler', 'euler')
      mockWidgets.set('1:sampler', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'sampler'])
      appModeStore.widgetOverrides['1:sampler'] = { min: 0, max: 10 }

      const { savePreset, applyPreset } = useAppPresets()
      const preset = savePreset('Sampler Preset')

      applyPreset(preset.id)
      expect(widget.value).toBe('euler')
    })

    it('ignores unknown preset id', () => {
      const widget = createWidget('steps', 20)
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { applyPreset } = useAppPresets()
      applyPreset('nonexistent')
      expect(widget.value).toBe(20)
    })
  })

  describe('deletePreset', () => {
    it('removes the preset by id', () => {
      mockWidgets.set('1:steps', createWidget('steps', 20))
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { savePreset, deletePreset, presets } = useAppPresets()
      const preset = savePreset('To Delete')

      deletePreset(preset.id)
      expect(presets.value).toHaveLength(0)
    })

    it('ignores unknown id', () => {
      mockWidgets.set('1:steps', createWidget('steps', 20))
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { savePreset, deletePreset, presets } = useAppPresets()
      savePreset('Keep')

      deletePreset('nonexistent')
      expect(presets.value).toHaveLength(1)
    })
  })

  describe('renamePreset', () => {
    it('updates the preset name', () => {
      mockWidgets.set('1:steps', createWidget('steps', 20))
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { savePreset, renamePreset, presets } = useAppPresets()
      const preset = savePreset('Old Name')

      renamePreset(preset.id, 'New Name')
      expect(presets.value[0].name).toBe('New Name')
    })
  })

  describe('updatePreset', () => {
    it('replaces preset values with current widget values', () => {
      const widget = createWidget('steps', 20)
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { savePreset, updatePreset, presets } = useAppPresets()
      const preset = savePreset('Updatable')

      widget.value = 42
      updatePreset(preset.id)

      expect(presets.value[0].values['1:steps']).toBe(42)
    })
  })

  describe('applyBuiltin', () => {
    it('sets numeric widgets to min when t=0', () => {
      const widget = createWidget('steps', 20, { min: 1, max: 100 })
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { applyBuiltin } = useAppPresets()
      applyBuiltin(0)
      expect(widget.value).toBe(1)
    })

    it('sets numeric widgets to max when t=1', () => {
      const widget = createWidget('steps', 20, { min: 1, max: 100 })
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { applyBuiltin } = useAppPresets()
      applyBuiltin(1)
      expect(widget.value).toBe(100)
    })

    it('sets numeric widgets to midpoint when t=0.5', () => {
      const widget = createWidget('steps', 20, { min: 0, max: 50 })
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { applyBuiltin } = useAppPresets()
      applyBuiltin(0.5)
      expect(widget.value).toBe(25)
    })

    it('respects widget overrides over widget options', () => {
      const widget = createWidget('steps', 20, { min: 1, max: 100 })
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])
      appModeStore.widgetOverrides['1:steps'] = { min: 10, max: 30 }

      const { applyBuiltin } = useAppPresets()
      applyBuiltin(1)
      expect(widget.value).toBe(30)
    })

    it('skips numeric widgets without min/max', () => {
      const widget = createWidget('steps', 20)
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { applyBuiltin } = useAppPresets()
      applyBuiltin(0)
      expect(widget.value).toBe(20)
    })

    it('picks first combo option at t=0', () => {
      const widget = createWidget('sampler', 'euler', {
        values: ['euler', 'dpmpp_2m', 'ddim']
      })
      mockWidgets.set('1:sampler', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'sampler'])

      const { applyBuiltin } = useAppPresets()
      applyBuiltin(0)
      expect(widget.value).toBe('euler')
    })

    it('picks middle combo option at t=0.5', () => {
      const widget = createWidget('ratio', '4:3', {
        values: ['1:1', '4:3', '16:9']
      })
      mockWidgets.set('1:ratio', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'ratio'])

      const { applyBuiltin } = useAppPresets()
      applyBuiltin(0.5)
      expect(widget.value).toBe('4:3')
    })

    it('picks last combo option at t=1', () => {
      const widget = createWidget('ratio', '4:3', {
        values: ['1:1', '4:3', '16:9']
      })
      mockWidgets.set('1:ratio', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'ratio'])

      const { applyBuiltin } = useAppPresets()
      applyBuiltin(1)
      expect(widget.value).toBe('16:9')
    })

    it('applies via applyPreset with builtin IDs', () => {
      const widget = createWidget('steps', 20, { min: 1, max: 100 })
      mockWidgets.set('1:steps', widget)
      appModeStore.selectedInputs.push(['1' as NodeId, 'steps'])

      const { applyPreset } = useAppPresets()
      applyPreset('__builtin:max')
      expect(widget.value).toBe(100)
    })
  })
})
