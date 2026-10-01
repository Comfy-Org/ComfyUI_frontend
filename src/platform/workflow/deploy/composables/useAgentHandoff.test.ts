import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from '@/base/common/downloadUtil'
import type { Distribution } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const distribution = vi.hoisted(
  (): { DISTRIBUTION: Distribution; isCloud: boolean } => ({
    DISTRIBUTION: 'cloud',
    isCloud: true
  })
)
vi.mock(import('@/platform/distribution/types'), () => distribution)

const copyToClipboard = vi.hoisted(() =>
  vi.fn((_text: string, _options?: { toastOnSuccess?: boolean }) =>
    Promise.resolve(true)
  )
)
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
        '# Turn `portrait-upscale` into a Comfy API Build'
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

  it.for([
    {
      distribution: 'localhost' as const,
      recipe: 'comfy which',
      other: '--from-snapshot'
    },
    {
      distribution: 'desktop' as const,
      recipe: '--from-snapshot',
      other: 'comfy which'
    }
  ])(
    'sends $distribution its own recipe and downloads nothing',
    async ({ distribution: target, recipe, other }) => {
      distribution.DISTRIBUTION = target
      distribution.isCloud = false
      setActiveWorkflow()

      await expect(useAgentHandoff().copyBrief()).resolves.toBe(true)

      const brief = String(copyToClipboard.mock.lastCall?.[0])
      expect(brief).toContain(recipe)
      expect(brief).not.toContain(other)
      expect(brief).not.toContain('--from-workflow')
      expect(downloadBlob).not.toHaveBeenCalled()
    }
  )

  it('lists the model a known loader loads, and not prompt text ending in .pt', async () => {
    useNodeDefStore().nodeDefsByName = {
      CheckpointLoaderSimple: fromPartial<ComfyNodeDefImpl>({
        name: 'CheckpointLoaderSimple'
      }),
      CLIPTextEncode: fromPartial<ComfyNodeDefImpl>({ name: 'CLIPTextEncode' })
    }
    setActiveWorkflow('portrait-upscale.json', {
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          widgets_values: ['sd_xl.safetensors']
        },
        {
          id: 2,
          type: 'CLIPTextEncode',
          widgets_values: ['a photo of my cat.pt']
        }
      ]
    })

    await useAgentHandoff().copyBrief()

    const brief = String(copyToClipboard.mock.lastCall?.[0])
    expect(brief).toContain('- `sd_xl.safetensors`')
    expect(brief).not.toContain('cat.pt')
  })

  it('lists every model input of a loader that has several', async () => {
    useNodeDefStore().nodeDefsByName = {
      INPAINT_LoadFooocusInpaint: fromPartial<ComfyNodeDefImpl>({
        name: 'INPAINT_LoadFooocusInpaint'
      })
    }
    setActiveWorkflow('portrait-upscale.json', {
      nodes: [
        {
          id: 1,
          type: 'INPAINT_LoadFooocusInpaint',
          widgets_values: {
            head: 'fooocus_inpaint_head.pth',
            patch: 'inpaint_v26.fooocus.patch'
          }
        }
      ]
    })

    await useAgentHandoff().copyBrief()

    const brief = String(copyToClipboard.mock.lastCall?.[0])
    expect(brief).toContain('- `fooocus_inpaint_head.pth`')
    expect(brief).toContain('- `inpaint_v26.fooocus.patch`')
  })

  it('keeps the file when the brief did not reach the clipboard', async () => {
    setActiveWorkflow()
    copyToClipboard.mockResolvedValueOnce(false)

    await expect(useAgentHandoff().copyBrief()).resolves.toBe(false)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'error_copying_deploy_agent_brief',
      surface: 'platform'
    })
  })

  it('reads a malformed workflow as empty instead of failing', async () => {
    setActiveWorkflow('broken.json', { nodes: 5 })

    await expect(useAgentHandoff().copyBrief()).resolves.toBe(true)

    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('No node classes were read from the graph.'),
      expect.anything()
    )
  })

  it('reports a graph it cannot capture and tells the user, instead of leaving the click unanswered', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'broken.json',
      activeState: GRAPH,
      changeTracker: {
        prepareForSave: () => {
          throw new TypeError('canvas is gone')
        }
      }
    })
    const toast = vi.spyOn(useToastStore(), 'add')

    await expect(useAgentHandoff().copyBrief()).resolves.toBe(false)

    expect(copyToClipboard).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
      errorType: 'error_copying_deploy_agent_brief',
      surface: 'platform'
    })
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'The brief for your agent could not be prepared. Try again.'
      })
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('reads the graph after capturing an edit still in a focused field', async () => {
    const workflow = {
      filename: 'portrait-upscale.json',
      activeState: { nodes: [{ id: 1, type: 'StaleClass' }] },
      changeTracker: {
        prepareForSave: () => {
          workflow.activeState = { nodes: [{ id: 1, type: 'FreshClass' }] }
        }
      }
    }
    useWorkflowStore().activeWorkflow = fromPartial(workflow)

    await useAgentHandoff().copyBrief()

    const brief = String(copyToClipboard.mock.lastCall?.[0])
    expect(brief).toContain('- `FreshClass`')
    expect(brief).not.toContain('StaleClass')
    const [, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(await blob.text()).toContain('FreshClass')
  })

  it('names the downloaded file exactly as the brief does, even for a name with a backtick', async () => {
    setActiveWorkflow('release`v2.json')

    await useAgentHandoff().copyBrief()

    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('downloaded the file as `releasev2.json`'),
      expect.anything()
    )
    expect(vi.mocked(downloadBlob).mock.calls[0][0]).toBe('releasev2.json')
  })

  it('names an unsaved workflow "workflow"', () => {
    useWorkflowStore().activeWorkflow = null

    expect(useAgentHandoff().captureInputs()).toEqual({
      workflowName: 'workflow',
      workflowFileName: 'workflow.json',
      nodeClasses: [],
      nodePacks: [],
      models: []
    })
  })
})
