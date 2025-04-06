import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { useWorkflowAutoSave } from '@/composables/useWorkflowAutoSave'
import { useWorkflowService } from '@/services/workflowService'

// Mock imports
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
})
