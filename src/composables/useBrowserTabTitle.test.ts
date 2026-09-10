import { fromPartial } from '@total-typescript/shoehorn'
import { useExecutionStore } from '@/stores/executionStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { useBrowserTabTitle } from '@/composables/useBrowserTabTitle'

vi.mock(import('firebase/auth'))

// Mock i18n module
vi.mock<unknown>(import('@/i18n'), () => ({
  t: (key: string, fallback: string) =>
    key === 'g.nodesRunning' ? 'nodes running' : fallback
}))

let executionStore: ReturnType<typeof useExecutionStore>

let settingStore: ReturnType<typeof useSettingStore>

let workflowStore: ReturnType<typeof useWorkflowStore>

let workspaceStore: ReturnType<typeof useWorkspaceStore>

describe('useBrowserTabTitle', () => {
  beforeEach(() => {
    executionStore = useExecutionStore()
    settingStore = useSettingStore()
    workflowStore = useWorkflowStore()
    workspaceStore = useWorkspaceStore()
    // reset execution store
    Object.assign(executionStore, {
      isIdle: true,
      executionProgress: 0,
      executingNode: null,
      executingNodeProgress: 0
    })
    executionStore.nodeProgressStates = {}

    // reset setting and workflow stores
    vi.mocked(settingStore.get).mockReturnValue('Enabled')
    workflowStore.activeWorkflow = null
    Object.assign(workspaceStore, { shiftDown: false })

    // reset document title
    document.title = ''
  })

  it('sets default title when idle and no workflow', () => {
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    expect(document.title).toBe('ComfyUI')
    scope.stop()
  })

  it('sets workflow name as title when workflow exists and menu enabled', async () => {
    vi.mocked(settingStore.get).mockReturnValue('Enabled')
    workflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof workflowStore.activeWorkflow>
    >({
      filename: 'myFlow',
      isModified: false,
      isPersisted: true
    })
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    await nextTick()
    expect(document.title).toBe('myFlow - ComfyUI')
    scope.stop()
  })

  it('adds asterisk for unsaved workflow', async () => {
    vi.mocked(settingStore.get).mockReturnValue('Enabled')
    workflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof workflowStore.activeWorkflow>
    >({
      filename: 'myFlow',
      isModified: true,
      isPersisted: true
    })
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    await nextTick()
    expect(document.title).toBe('*myFlow - ComfyUI')
    scope.stop()
  })

  it('hides asterisk when autosave is enabled', async () => {
    vi.mocked(settingStore.get).mockImplementation((key: string) => {
      if (key === 'Comfy.Workflow.AutoSave') return 'after delay'
      if (key === 'Comfy.UseNewMenu') return 'Enabled'
      return 'Enabled'
    })
    workflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof workflowStore.activeWorkflow>
    >({
      filename: 'myFlow',
      isModified: true,
      isPersisted: true
    })
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    await nextTick()
    expect(document.title).toBe('myFlow - ComfyUI')
    scope.stop()
  })

  it('hides asterisk while Shift key is held', async () => {
    vi.mocked(settingStore.get).mockImplementation((key: string) => {
      if (key === 'Comfy.Workflow.AutoSave') return 'off'
      if (key === 'Comfy.UseNewMenu') return 'Enabled'
      return 'Enabled'
    })
    Object.assign(workspaceStore, { shiftDown: true })
    workflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof workflowStore.activeWorkflow>
    >({
      filename: 'myFlow',
      isModified: true,
      isPersisted: true
    })
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    await nextTick()
    expect(document.title).toBe('myFlow - ComfyUI')
    scope.stop()
  })

  it('disables workflow title when menu disabled', async () => {
    vi.mocked(settingStore.get).mockReturnValue('Disabled')
    workflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof workflowStore.activeWorkflow>
    >({
      filename: 'myFlow',
      isModified: false,
      isPersisted: true
    })
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    await nextTick()
    expect(document.title).toBe('ComfyUI')
    scope.stop()
  })

  it('shows execution progress when not idle without workflow', async () => {
    Object.assign(executionStore, { isIdle: false })
    Object.assign(executionStore, { executionProgress: 0.3 })
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    await nextTick()
    expect(document.title).toBe('[30%]ComfyUI')
    scope.stop()
  })

  it('shows node execution title when executing a node using nodeProgressStates', async () => {
    Object.assign(executionStore, { isIdle: false })
    Object.assign(executionStore, { executionProgress: 0.4 })
    Object.assign(executionStore, {
      executingNode: {
        type: 'Foo'
      }
    })
    executionStore.nodeProgressStates = {
      '1': {
        state: 'running',
        value: 5,
        max: 10,
        node_id: '1',
        prompt_id: 'test'
      }
    }
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    await nextTick()
    expect(document.title).toBe('[40%][50%] Foo')
    scope.stop()
  })

  it('shows multiple nodes running when multiple nodes are executing', async () => {
    Object.assign(executionStore, { isIdle: false })
    Object.assign(executionStore, { executionProgress: 0.4 })
    executionStore.nodeProgressStates = {
      '1': {
        state: 'running',
        value: 5,
        max: 10,
        node_id: '1',
        prompt_id: 'test'
      },
      '2': {
        state: 'running',
        value: 8,
        max: 10,
        node_id: '2',
        prompt_id: 'test'
      }
    }
    const scope = effectScope()
    scope.run(() => useBrowserTabTitle())
    await nextTick()
    expect(document.title).toBe('[40%][2 nodes running]')
    scope.stop()
  })
})
