import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useWorkflowActionsService } from './workflowActionsService'

const mockPrompt = vi.hoisted(() => vi.fn())
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ prompt: mockPrompt })
}))

const mockGetSetting = vi.hoisted(() => vi.fn())
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: mockGetSetting })
}))

const mockDownloadBlob = vi.hoisted(() => vi.fn())
vi.mock('@/scripts/utils', () => ({
  downloadBlob: mockDownloadBlob
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ createTemporary: vi.fn() })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({ openWorkflow: vi.fn() })
}))

const minimalWorkflow: ComfyWorkflowJSON = {
  version: 0.4,
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: []
}

describe('workflowActionsService.exportWorkflowAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { cancelled: true } when the user dismisses the filename prompt', async () => {
    mockGetSetting.mockReturnValue(true)
    mockPrompt.mockResolvedValue(null)
    const { exportWorkflowAction } = useWorkflowActionsService()

    const result = await exportWorkflowAction(minimalWorkflow, 'wf.json')

    expect(result).toEqual({ success: false, cancelled: true })
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it('downloads with the prompted filename and returns success', async () => {
    mockGetSetting.mockReturnValue(true)
    mockPrompt.mockResolvedValue('custom')
    const { exportWorkflowAction } = useWorkflowActionsService()

    const result = await exportWorkflowAction(minimalWorkflow, 'wf.json')

    expect(result).toEqual({ success: true })
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      'custom.json',
      expect.any(Blob)
    )
  })

  it('skips the prompt and uses the default filename when the setting is off', async () => {
    mockGetSetting.mockReturnValue(false)
    const { exportWorkflowAction } = useWorkflowActionsService()

    const result = await exportWorkflowAction(minimalWorkflow, 'default.json')

    expect(result).toEqual({ success: true })
    expect(mockPrompt).not.toHaveBeenCalled()
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      'default.json',
      expect.any(Blob)
    )
  })

  it('returns the no-workflow error when given null', async () => {
    const { exportWorkflowAction } = useWorkflowActionsService()

    const result = await exportWorkflowAction(null, 'wf.json')

    expect(result).toEqual({
      success: false,
      error: 'No workflow data available'
    })
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })
})
