import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowAutoSave } from '@/composables/useWorkflowAutoSave'
import { useWorkflowService } from '@/services/workflowService'

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@/services/workflowService', () => ({
  useWorkflowService: vi.fn(() => ({
    saveWorkflow: vi.fn()
  }))
}))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn((key) => {
      if (key === 'Comfy.Workflow.AutoSave') return mockAutoSaveSetting
      if (key === 'Comfy.Workflow.AutoSaveDelay') return mockAutoSaveDelay
      return null
    })
  }))
}))

vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    activeWorkflow: mockActiveWorkflow
  }))
}))

let mockAutoSaveSetting: string = 'off'
let mockAutoSaveDelay: number = 1000
let mockActiveWorkflow: { isModified: boolean } | null = null

describe('useWorkflowAutoSave', () => {
  beforeEach(() => {
    mockAutoSaveSetting = 'off'
    mockAutoSaveDelay = 1000
    mockActiveWorkflow = null
    vi.clearAllMocks()
  })

  it('should auto-save workflow after delay when modified and autosave enabled', async () => {
    vi.useFakeTimers()

    mockAutoSaveSetting = 'after delay'
    mockAutoSaveDelay = 1000
    mockActiveWorkflow = { isModified: true }

    mount({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    vi.advanceTimersByTime(1000)

    const serviceInstance = (useWorkflowService as any).mock.results[0].value
    expect(serviceInstance.saveWorkflow).toHaveBeenCalledWith(
      mockActiveWorkflow
    )

    vi.useRealTimers()
  })

  it('should not auto save workflow when autosave is off', async () => {
    vi.useFakeTimers()

    mockAutoSaveSetting = 'off'
    mockAutoSaveDelay = 1000
    mockActiveWorkflow = { isModified: true }

    mount({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    vi.advanceTimersByTime(mockAutoSaveDelay)

    const serviceInstance = (useWorkflowService as any).mock.results[0].value
    expect(serviceInstance.saveWorkflow).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('should respect the user specified auto save delay', async () => {
    vi.useFakeTimers()

    mockAutoSaveSetting = 'after delay'
    mockAutoSaveDelay = 2000
    mockActiveWorkflow = { isModified: true }

    mount({
      template: `<div></div>`,
      setup() {
        useWorkflowAutoSave()
        return {}
      }
    })

    vi.advanceTimersByTime(1000)

    const serviceInstance = (useWorkflowService as any).mock.results[0].value
    expect(serviceInstance.saveWorkflow).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)

    expect(serviceInstance.saveWorkflow).toHaveBeenCalled()
  })
})
