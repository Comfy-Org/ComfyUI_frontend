import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from '@/base/common/downloadUtil'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const distribution = vi.hoisted(() => ({
  DISTRIBUTION: 'cloud' as 'cloud' | 'localhost' | 'desktop',
  isCloud: true
}))
vi.mock<unknown>(import('@/platform/distribution/types'), () => distribution)

const copyToClipboard = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({ copyToClipboard })
}))

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const GRAPH = { nodes: [{ id: 1, type: 'KSampler' }], links: [] }

function setActiveWorkflow(
  filename = 'portrait-upscale.json',
  activeState: Record<string, unknown> = GRAPH
) {
  useWorkflowStore().activeWorkflow = fromPartial({
    filename,
    activeState,
    changeTracker: { prepareForSave: vi.fn() }
  })
}

describe('useAgentHandoff', () => {
  beforeEach(() => {
    distribution.DISTRIBUTION = 'cloud'
    distribution.isCloud = true
  })

  it('copies the brief for the workflow open at the click, then downloads that same graph under the name the brief gives', async () => {
    setActiveWorkflow('draft.json', { nodes: [] })
    const handoff = useAgentHandoff()
    setActiveWorkflow()

    await expect(handoff.copyBrief()).resolves.toBe(true)

    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining(
        '# Turn "portrait-upscale" into a Comfy API Build'
      ),
      { toastOnSuccess: false }
    )
    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('downloaded the file as `portrait-upscale.json`'),
      expect.anything()
    )
    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('- `KSampler`'),
      expect.anything()
    )
    expect(downloadBlob).toHaveBeenCalledOnce()
    const [filename, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(filename).toBe('portrait-upscale.json')
    expect(JSON.parse(await blob.text())).toEqual(GRAPH)
  })

  it('copies before it downloads, so the click still counts for the clipboard', async () => {
    setActiveWorkflow()
    const order: string[] = []
    copyToClipboard.mockImplementationOnce(async () => {
      order.push('copy')
      return true
    })
    vi.mocked(downloadBlob).mockImplementationOnce(() => {
      order.push('download')
    })

    await useAgentHandoff().copyBrief()

    expect(order).toEqual(['copy', 'download'])
  })

  it('downloads nothing off Cloud, where the agent reads the install', async () => {
    distribution.DISTRIBUTION = 'localhost'
    distribution.isCloud = false
    setActiveWorkflow()

    await expect(useAgentHandoff().copyBrief()).resolves.toBe(true)

    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('comfy which'),
      expect.anything()
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('keeps the file when the brief did not reach the clipboard', async () => {
    setActiveWorkflow()
    copyToClipboard.mockResolvedValueOnce(false)

    await expect(useAgentHandoff().copyBrief()).resolves.toBe(false)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'error_copying_deploy_agent_brief'
    })
  })

  it('reports a workflow it cannot read and tells the user, instead of leaving the click unanswered', async () => {
    setActiveWorkflow('broken.json', { nodes: 5 })
    const toast = vi.spyOn(useToastStore(), 'add')

    await expect(useAgentHandoff().copyBrief()).resolves.toBe(false)

    expect(copyToClipboard).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
      errorType: 'error_copying_deploy_agent_brief'
    })
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'The brief for your agent could not be prepared. Try again.'
      })
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('captures an edit still in a focused field before it reads the graph', async () => {
    const prepareForSave = vi.fn()
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'portrait-upscale.json',
      activeState: GRAPH,
      changeTracker: { prepareForSave }
    })

    await useAgentHandoff().copyBrief()

    expect(prepareForSave).toHaveBeenCalled()
    expect(prepareForSave.mock.invocationCallOrder[0]).toBeLessThan(
      copyToClipboard.mock.invocationCallOrder[0]
    )
  })

  it('names an unsaved workflow "workflow"', () => {
    useWorkflowStore().activeWorkflow = null

    expect(useAgentHandoff().currentInputs()).toEqual({
      workflowName: 'workflow',
      workflowFileName: 'workflow.json',
      nodeClasses: [],
      nodePacks: [],
      models: []
    })
  })
})
