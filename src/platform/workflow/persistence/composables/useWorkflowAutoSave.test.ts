import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/vue'

import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowAutoSave } from '@/platform/workflow/persistence/composables/useWorkflowAutoSave'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'))

vi.mock(import('@/platform/workflow/core/services/workflowService'))

beforeEach(() => {
  useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'off'
  useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 1000
})

describe('useWorkflowAutoSave', () => {
  it('should auto-save workflow after delay when modified and autosave enabled', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 1000
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: true, isPersisted: true }
    })

    render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    vi.advanceTimersByTime(1000)

    expect(useWorkflowService().saveWorkflow).toHaveBeenCalledWith(
      useWorkflowStore().activeWorkflow
    )
  })

  it('should not auto-save workflow after delay when not modified and autosave enabled', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 1000
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: false, isPersisted: true }
    })

    render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    vi.advanceTimersByTime(1000)

    expect(useWorkflowService().saveWorkflow).not.toHaveBeenCalledWith(
      useWorkflowStore().activeWorkflow
    )
  })

  it('should not auto save workflow when autosave is off', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'off'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 1000
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: true, isPersisted: true }
    })

    render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    vi.advanceTimersByTime(1000)

    expect(useWorkflowService().saveWorkflow).not.toHaveBeenCalled()
  })

  it('should respect the user specified auto save delay', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 2000
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: true, isPersisted: true }
    })

    render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    vi.advanceTimersByTime(1000)

    expect(useWorkflowService().saveWorkflow).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)

    expect(useWorkflowService().saveWorkflow).toHaveBeenCalled()
  })

  it('should debounce save requests', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 2000
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: true, isPersisted: true }
    })

    render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    const graphChangedCallback = vi.mocked(api.addEventListener).mock
      .calls[0][1]

    graphChangedCallback?.({} as Parameters<typeof graphChangedCallback>[0])

    vi.advanceTimersByTime(500)

    graphChangedCallback?.({} as Parameters<typeof graphChangedCallback>[0])

    vi.advanceTimersByTime(1999)
    expect(useWorkflowService().saveWorkflow).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(useWorkflowService().saveWorkflow).toHaveBeenCalledTimes(1)
  })

  it('should handle save error gracefully', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 1000
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: true, isPersisted: true }
    })

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    try {
      render({
        template: `<div></div>`,
        setup() {
          useWorkflowAutoSave()
          return {}
        }
      })

      vi.mocked(useWorkflowService()).saveWorkflow.mockRejectedValue(
        new Error('Test Error')
      )

      vi.advanceTimersByTime(1000)
      await Promise.resolve()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Auto save failed:',
        expect.any(Error)
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('should queue autosave requests during saving and reschedule after save completes', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 1000
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: true, isPersisted: true }
    })

    render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    let resolveSave: (saved: boolean) => void
    const firstSavePromise = new Promise<boolean>((resolve) => {
      resolveSave = resolve
    })

    vi.mocked(useWorkflowService()).saveWorkflow.mockImplementationOnce(
      () => firstSavePromise
    )

    vi.advanceTimersByTime(1000)

    const graphChangedCallback = vi.mocked(api.addEventListener).mock
      .calls[0][1]
    graphChangedCallback?.({} as Parameters<typeof graphChangedCallback>[0])

    resolveSave!(true)
    await Promise.resolve()

    vi.advanceTimersByTime(1000)
    expect(useWorkflowService().saveWorkflow).toHaveBeenCalledTimes(2)
  })

  it('should clean up event listeners on component unmount', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'

    const { unmount } = render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    unmount()

    expect(api.removeEventListener).toHaveBeenCalled()
  })

  it('should handle edge case delay values properly', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 0
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: true, isPersisted: true }
    })

    render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    await vi.runAllTimersAsync()

    expect(useWorkflowService().saveWorkflow).toHaveBeenCalledTimes(1)
    vi.mocked(useWorkflowService()).saveWorkflow.mockClear()

    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = -500

    const graphChangedCallback = vi.mocked(api.addEventListener).mock
      .calls[0][1]
    graphChangedCallback?.({} as Parameters<typeof graphChangedCallback>[0])

    await vi.runAllTimersAsync()

    expect(useWorkflowService().saveWorkflow).toHaveBeenCalledTimes(1)
  })

  it('should not autosave if workflow is not persisted', async () => {
    useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'after delay'
    useSettingStore().settingValues['Comfy.Workflow.AutoSaveDelay'] = 1000
    Object.assign(useWorkflowStore(), {
      activeWorkflow: { isModified: true, isPersisted: false }
    })

    render({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    vi.advanceTimersByTime(1000)

    expect(useWorkflowService().saveWorkflow).not.toHaveBeenCalledWith(
      useWorkflowStore().activeWorkflow
    )
  })
})
