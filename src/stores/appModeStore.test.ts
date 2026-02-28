import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { AppMode } from '@/composables/useAppMode'

import { useAppModeStore } from '@/stores/appModeStore'

const modeRef = ref<AppMode>('graph')
const mockSetMode = vi.fn()

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    mode: computed(() => modeRef.value),
    setMode: mockSetMode,
    isBuilderMode: computed(
      () =>
        modeRef.value === 'builder:select' ||
        modeRef.value === 'builder:arrange'
    ),
    isAppMode: computed(
      () => modeRef.value === 'app' || modeRef.value === 'builder:arrange'
    ),
    isSelectMode: computed(() => modeRef.value === 'builder:select'),
    isArrangeMode: computed(() => modeRef.value === 'builder:arrange'),
    isGraphMode: computed(
      () => modeRef.value === 'graph' || modeRef.value === 'builder:select'
    )
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({ read_only: false })
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: null
  })
}))

describe('appModeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    modeRef.value = 'graph'
    mockSetMode.mockClear()
  })

  describe('enterBuilder', () => {
    it('navigates to builder:arrange when in app mode with outputs', () => {
      modeRef.value = 'app'
      const store = useAppModeStore()
      store.selectedOutputs.push('1')

      store.enterBuilder()

      expect(mockSetMode).toHaveBeenCalledWith('builder:arrange')
    })

    it('navigates to builder:select when in app mode without outputs', () => {
      modeRef.value = 'app'
      const store = useAppModeStore()

      store.enterBuilder()

      expect(mockSetMode).toHaveBeenCalledWith('builder:select')
    })

    it('navigates to builder:select when in graph mode with outputs', () => {
      modeRef.value = 'graph'
      const store = useAppModeStore()
      store.selectedOutputs.push('1')

      store.enterBuilder()

      expect(mockSetMode).toHaveBeenCalledWith('builder:select')
    })

    it('navigates to builder:select when in graph mode without outputs', () => {
      modeRef.value = 'graph'
      const store = useAppModeStore()

      store.enterBuilder()

      expect(mockSetMode).toHaveBeenCalledWith('builder:select')
    })
  })
})
