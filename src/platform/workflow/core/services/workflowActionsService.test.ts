import { useSettingStore } from '@/platform/settings/settingStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import * as utils from '@/scripts/utils'
import { useWorkflowActionsService } from './workflowActionsService'

const mockPrompt = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/services/dialogService'), () => ({
  useDialogService: () => ({ prompt: mockPrompt })
}))

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: () => ({ openWorkflow: vi.fn() })
  })
)

const minimalWorkflow: ComfyWorkflowJSON = {
  version: 0.4,
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: []
}

beforeEach(() => {
  vi.spyOn(utils, 'downloadBlob').mockImplementation(() => {})
})

describe('workflowActionsService.exportWorkflowAction', () => {
  it('returns { cancelled: true } when the user dismisses the filename prompt', async () => {
    useSettingStore().settingValues['Comfy.PromptFilename'] = true
    mockPrompt.mockResolvedValue(null)
    const { exportWorkflowAction } = useWorkflowActionsService()

    const result = await exportWorkflowAction(minimalWorkflow, 'wf.json')

    expect(result).toEqual({ success: false, cancelled: true })
    expect(utils.downloadBlob).not.toHaveBeenCalled()
  })

  it('downloads with the prompted filename and returns success', async () => {
    useSettingStore().settingValues['Comfy.PromptFilename'] = true
    mockPrompt.mockResolvedValue('custom')
    const { exportWorkflowAction } = useWorkflowActionsService()

    const result = await exportWorkflowAction(minimalWorkflow, 'wf.json')

    expect(result).toEqual({ success: true })
    expect(utils.downloadBlob).toHaveBeenCalledWith(
      'custom.json',
      expect.any(Blob)
    )
  })

  it('skips the prompt and uses the default filename when the setting is off', async () => {
    useSettingStore().settingValues['Comfy.PromptFilename'] = false
    const { exportWorkflowAction } = useWorkflowActionsService()

    const result = await exportWorkflowAction(minimalWorkflow, 'default.json')

    expect(result).toEqual({ success: true })
    expect(mockPrompt).not.toHaveBeenCalled()
    expect(utils.downloadBlob).toHaveBeenCalledWith(
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
    expect(utils.downloadBlob).not.toHaveBeenCalled()
  })
})
