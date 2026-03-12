import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

import type * as VueModule from 'vue'

// Mock onMounted to execute callback immediately
vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal<typeof VueModule>()
  return { ...vue, onMounted: (fn: () => void) => fn() }
})

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: {} }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getExecutionIdByNode: vi.fn(() => '42')
}))

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => false)
  }))
}))

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    clearMissingModelState: vi.fn()
  })
)

import { app } from '@/scripts/app'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { useNodeErrorAutoResolve } from './useNodeErrorAutoResolve'

function createMockNode(id: number = 5): LGraphNode {
  return {
    id,
    onWidgetChanged: undefined,
    onConnectionsChange: undefined
  } as unknown as LGraphNode
}

describe('useNodeErrorAutoResolve', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getExecutionIdByNode).mockReturnValue('42')
    ;(app as { rootGraph: unknown }).rootGraph = {}
  })

  function setupExtension(): {
    node: LGraphNode
    executionErrorStore: ReturnType<typeof useExecutionErrorStore>
    missingModelStore: ReturnType<typeof useMissingModelStore>
  } {
    const extensionStore = useExtensionStore()
    useNodeErrorAutoResolve()

    const ext = extensionStore.extensions[0]
    const node = createMockNode()
    const executionErrorStore = useExecutionErrorStore()
    const missingModelStore = useMissingModelStore()

    ext.nodeCreated!(node, {} as never)

    return { node, executionErrorStore, missingModelStore }
  }

  describe('extension registration', () => {
    it('registers the extension exactly once', () => {
      const extensionStore = useExtensionStore()

      useNodeErrorAutoResolve()
      useNodeErrorAutoResolve()

      expect(
        extensionStore.extensions.filter(
          (e) => e.name === 'Comfy.NodeErrorAutoResolve'
        )
      ).toHaveLength(1)
    })
  })

  describe('onWidgetChanged', () => {
    it('calls clearSimpleWidgetErrorIfValid with correct arguments', () => {
      const { node, executionErrorStore } = setupExtension()
      const clearSpy = vi.spyOn(
        executionErrorStore,
        'clearSimpleWidgetErrorIfValid'
      )

      const widget = { name: 'steps', options: { min: 1, max: 100 } }
      node.onWidgetChanged!.call(node, 'steps', 50, 30, widget as never)

      expect(clearSpy).toHaveBeenCalledWith('42', 'steps', 50, {
        min: 1,
        max: 100
      })
    })

    it('does nothing when rootGraph is null', () => {
      const { node, executionErrorStore } = setupExtension()
      const clearSpy = vi.spyOn(
        executionErrorStore,
        'clearSimpleWidgetErrorIfValid'
      )
      ;(app as { rootGraph: unknown }).rootGraph = null

      const widget = { name: 'steps', options: {} }
      node.onWidgetChanged!.call(node, 'steps', 50, 30, widget as never)

      expect(clearSpy).not.toHaveBeenCalled()
    })

    it('passes only min/max from widget options', () => {
      const { node, executionErrorStore } = setupExtension()
      const clearSpy = vi.spyOn(
        executionErrorStore,
        'clearSimpleWidgetErrorIfValid'
      )

      const widget = {
        name: 'cfg',
        options: { min: 0, max: 20, step: 0.5, extra: 'ignored' }
      }
      node.onWidgetChanged!.call(node, 'cfg', 10, 5, widget as never)

      expect(clearSpy).toHaveBeenCalledWith('42', 'cfg', 10, {
        min: 0,
        max: 20
      })
    })

    it('calls removeMissingModelByWidget on widget change', () => {
      const { node, missingModelStore } = setupExtension()
      const removeSpy = vi.spyOn(
        missingModelStore,
        'removeMissingModelByWidget'
      )

      const widget = { name: 'ckpt_name', options: {} }
      node.onWidgetChanged!.call(
        node,
        'ckpt_name',
        'v1.safetensors',
        '',
        widget as never
      )

      expect(removeSpy).toHaveBeenCalledWith('42', 'ckpt_name')
    })
  })

  describe('onConnectionsChange', () => {
    it('calls clearSimpleNodeErrors for INPUT connection', () => {
      const { node, executionErrorStore } = setupExtension()
      const clearSpy = vi.spyOn(executionErrorStore, 'clearSimpleNodeErrors')

      node.onConnectionsChange!.call(
        node,
        NodeSlotType.INPUT,
        0,
        true,
        {} as never,
        { name: 'clip' } as never
      )

      expect(clearSpy).toHaveBeenCalledWith('42', 'clip')
    })

    it('ignores OUTPUT connections', () => {
      const { node, executionErrorStore } = setupExtension()
      const clearSpy = vi.spyOn(executionErrorStore, 'clearSimpleNodeErrors')

      node.onConnectionsChange!.call(
        node,
        NodeSlotType.OUTPUT,
        0,
        true,
        {} as never,
        { name: 'out' } as never
      )

      expect(clearSpy).not.toHaveBeenCalled()
    })

    it('ignores disconnections', () => {
      const { node, executionErrorStore } = setupExtension()
      const clearSpy = vi.spyOn(executionErrorStore, 'clearSimpleNodeErrors')

      node.onConnectionsChange!.call(
        node,
        NodeSlotType.INPUT,
        0,
        false,
        {} as never,
        { name: 'clip' } as never
      )

      expect(clearSpy).not.toHaveBeenCalled()
    })

    it('does not clear errors when slot name is undefined', () => {
      const { node, executionErrorStore } = setupExtension()
      const clearSpy = vi.spyOn(executionErrorStore, 'clearSimpleNodeErrors')

      node.onConnectionsChange!.call(
        node,
        NodeSlotType.INPUT,
        0,
        true,
        {} as never,
        undefined as never
      )

      expect(clearSpy).not.toHaveBeenCalled()
    })

    it('does nothing when rootGraph is null', () => {
      const { node, executionErrorStore } = setupExtension()
      const clearSpy = vi.spyOn(executionErrorStore, 'clearSimpleNodeErrors')
      ;(app as { rootGraph: unknown }).rootGraph = null

      node.onConnectionsChange!.call(
        node,
        NodeSlotType.INPUT,
        0,
        true,
        {} as never,
        { name: 'clip' } as never
      )

      expect(clearSpy).not.toHaveBeenCalled()
    })
  })
})
