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

const mockCreateTemporary = vi.hoisted(() => vi.fn())
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ createTemporary: mockCreateTemporary })
}))

const mockOpenWorkflow = vi.hoisted(() => vi.fn())
vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({ openWorkflow: mockOpenWorkflow })
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
    mockCreateTemporary.mockReturnValue({ path: 'temporary.json' })
    mockOpenWorkflow.mockResolvedValue({ path: 'temporary.json' })
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

  it('returns a fallback error when export throws a non-error value', async () => {
    mockGetSetting.mockReturnValue(false)
    mockDownloadBlob.mockImplementationOnce(() => {
      throw 'download failed'
    })
    const { exportWorkflowAction } = useWorkflowActionsService()

    const result = await exportWorkflowAction(minimalWorkflow, 'wf.json')

    expect(result).toEqual({
      success: false,
      error: 'Failed to export workflow'
    })
  })
})

describe('workflowActionsService.openWorkflowAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTemporary.mockReturnValue({ path: 'temporary.json' })
    mockOpenWorkflow.mockResolvedValue({ path: 'temporary.json' })
  })

  it('opens a temporary workflow and returns success', async () => {
    const { openWorkflowAction } = useWorkflowActionsService()

    const result = await openWorkflowAction(minimalWorkflow, 'wf.json')

    expect(result).toEqual({ success: true })
    expect(mockCreateTemporary).toHaveBeenCalledWith('wf.json', minimalWorkflow)
    expect(mockOpenWorkflow).toHaveBeenCalledWith({ path: 'temporary.json' })
  })

  it('returns the no-workflow error when opening null', async () => {
    const { openWorkflowAction } = useWorkflowActionsService()

    const result = await openWorkflowAction(null, 'wf.json')

    expect(result).toEqual({
      success: false,
      error: 'No workflow data available'
    })
    expect(mockCreateTemporary).not.toHaveBeenCalled()
  })

  it('returns thrown error messages from failed opens', async () => {
    mockOpenWorkflow.mockRejectedValueOnce(new Error('Open failed'))
    const { openWorkflowAction } = useWorkflowActionsService()

    const result = await openWorkflowAction(minimalWorkflow, 'wf.json')

    expect(result).toEqual({
      success: false,
      error: 'Open failed'
    })
  })

  it('returns a fallback error when opening throws a non-error value', async () => {
    mockOpenWorkflow.mockRejectedValueOnce('Open failed')
    const { openWorkflowAction } = useWorkflowActionsService()

    const result = await openWorkflowAction(minimalWorkflow, 'wf.json')

    expect(result).toEqual({
      success: false,
      error: 'Failed to open workflow'
    })
  })
})
