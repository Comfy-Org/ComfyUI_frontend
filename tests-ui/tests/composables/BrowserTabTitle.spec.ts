import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { useBrowserTabTitle } from '@/composables/useBrowserTabTitle'

// Mock the execution store
const executionStore = reactive({
  isIdle: true,
  executionProgress: 0,
  executingNode: null as any,
  executingNodeProgress: 0
})
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => executionStore
}))

// Mock the setting store
const settingStore = reactive({
  get: vi.fn(() => 'Enabled')
})
vi.mock('@/stores/settingStore', () => ({
  useSettingStore: () => settingStore
}))

// Mock the workflow store
const workflowStore = reactive({
  activeWorkflow: null as any
})
vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: () => workflowStore
}))

describe('useBrowserTabTitle', () => {
  beforeEach(() => {
    // reset execution store
    executionStore.isIdle = true
    executionStore.executionProgress = 0
    executionStore.executingNode = null as any
    executionStore.executingNodeProgress = 0

    // reset setting and workflow stores
    ;(settingStore.get as any).mockReturnValue('Enabled')
    workflowStore.activeWorkflow = null

    // reset document title
    document.title = ''
  })

  it('sets default title when idle and no workflow', () => {
    useBrowserTabTitle()
    expect(document.title).toBe('ComfyUI')
  })

  it('sets workflow name as title when workflow exists and menu enabled', async () => {
    ;(settingStore.get as any).mockReturnValue('Enabled')
    workflowStore.activeWorkflow = {
      filename: 'myFlow',
      isModified: false,
      isPersisted: true
    }
    useBrowserTabTitle()
    await nextTick()
    expect(document.title).toBe('myFlow - ComfyUI')
  })

  it('adds asterisk for unsaved workflow', async () => {
    ;(settingStore.get as any).mockReturnValue('Enabled')
    workflowStore.activeWorkflow = {
      filename: 'myFlow',
      isModified: true,
      isPersisted: true
    }
    useBrowserTabTitle()
    await nextTick()
    expect(document.title).toBe('*myFlow - ComfyUI')
  })

  // Fails when run together with other tests. Suspect to be caused by leaked
  // state from previous tests.
  it.skip('disables workflow title when menu disabled', async () => {
    ;(settingStore.get as any).mockReturnValue('Disabled')
    workflowStore.activeWorkflow = {
      filename: 'myFlow',
      isModified: false,
      isPersisted: true
    }
    useBrowserTabTitle()
    await nextTick()
    expect(document.title).toBe('ComfyUI')
  })

  it('shows execution progress when not idle without workflow', async () => {
    executionStore.isIdle = false
    executionStore.executionProgress = 0.3
    useBrowserTabTitle()
    await nextTick()
    expect(document.title).toBe('[30%]ComfyUI')
  })

  it('shows node execution title when executing a node', async () => {
    executionStore.isIdle = false
    executionStore.executionProgress = 0.4
    executionStore.executingNodeProgress = 0.5
    executionStore.executingNode = { type: 'Foo' }
    useBrowserTabTitle()
    await nextTick()
    expect(document.title).toBe('[40%][50%] Foo')
  })
})
