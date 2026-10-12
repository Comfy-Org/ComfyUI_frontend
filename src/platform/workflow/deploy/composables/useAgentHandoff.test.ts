import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { reportError } from '@/platform/telemetry/reportError'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

vi.mock(import('@/composables/useCopyToClipboard'), () => {
  const copyToClipboard = vi.fn(
    (_text: string, _options?: { toastOnSuccess?: boolean }) =>
      Promise.resolve(true)
  )
  return { useCopyToClipboard: () => ({ copyToClipboard }) }
})

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
  it('copies the brief for the workflow open at the click, then downloads that same graph under the name the brief gives', async () => {
    setActiveWorkflow('draft.json', { nodes: [] })
    const handoff = useAgentHandoff()
    setActiveWorkflow()

    await expect(handoff.copyBrief()).resolves.toBe(true)

    expect(useCopyToClipboard().copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining(
        '# Turn `portrait-upscale` into a Comfy API Build'
      ),
      { toastOnSuccess: false }
    )
    expect(useCopyToClipboard().copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining(
        'downloaded the workflow as `portrait-upscale.json`'
      ),
      expect.anything()
    )
    expect(useCopyToClipboard().copyToClipboard).toHaveBeenCalledWith(
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
    vi.mocked(useCopyToClipboard().copyToClipboard).mockImplementationOnce(
      async () => {
        order.push('copy')
        return true
      }
    )
    vi.mocked(downloadBlob).mockImplementationOnce(() => {
      order.push('download')
    })

    await useAgentHandoff().copyBrief()

    expect(order).toEqual(['copy', 'download'])
  })

  it.for([
    {
      distribution: 'localhost',
      path: '## Your path: create from the install, or from the workflow file',
      downloads: 1
    },
    {
      distribution: 'desktop',
      path: '## Your path: create from the Desktop snapshot',
      downloads: 0
    }
  ] as const)(
    'sends $distribution its own path, downloading the workflow $downloads times',
    async ({ distribution, path, downloads }) => {
      setActiveWorkflow()

      await expect(useAgentHandoff(distribution).copyBrief()).resolves.toBe(
        true
      )

      expect(
        String(
          vi.mocked(useCopyToClipboard().copyToClipboard).mock.lastCall?.[0]
        )
      ).toContain(path)
      expect(downloadBlob).toHaveBeenCalledTimes(downloads)
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

    const brief = String(
      vi.mocked(useCopyToClipboard().copyToClipboard).mock.lastCall?.[0]
    )
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

    const brief = String(
      vi.mocked(useCopyToClipboard().copyToClipboard).mock.lastCall?.[0]
    )
    expect(brief).toContain('- `fooocus_inpaint_head.pth`')
    expect(brief).toContain('- `inpaint_v26.fooocus.patch`')
  })

  it.for([
    {
      format: 'named',
      nodeType: 'LoadLoraModel',
      values: {
        'loras.0.lora_name': 'A.safetensors',
        'loras.2.lora_name': 'B.safetensors',
        prompt: 'C.safetensors'
      }
    },
    {
      format: 'positional',
      nodeType: 'LoadLoraTextEncoder',
      values: ['B.safetensors', 0.5, true, 'A.safetensors', 1, false]
    }
  ])(
    'lists repeated LoRA model fields in a $format workflow',
    ({ nodeType, values }) => {
      useNodeDefStore().nodeDefsByName = {
        [nodeType]: fromPartial<ComfyNodeDefImpl>({ name: nodeType })
      }
      setActiveWorkflow('loras.json', {
        nodes: [{ id: 1, type: nodeType, widgets_values: values }]
      })

      expect(useAgentHandoff().captureInputs().models).toEqual([
        'A.safetensors',
        'B.safetensors'
      ])
    }
  )

  it('keeps the file when the brief did not reach the clipboard', async () => {
    setActiveWorkflow()
    vi.mocked(useCopyToClipboard().copyToClipboard).mockResolvedValueOnce(false)

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

    expect(useCopyToClipboard().copyToClipboard).toHaveBeenCalledWith(
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

    await expect(useAgentHandoff().copyBrief()).resolves.toBe(false)

    expect(useCopyToClipboard().copyToClipboard).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
      errorType: 'error_copying_deploy_agent_brief',
      surface: 'platform'
    })
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        description:
          'The brief for your agent could not be prepared. Try again.',
        kind: 'error'
      })
    ])
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('reports a download that fails after the brief was copied, and tells the user', async () => {
    setActiveWorkflow()
    vi.mocked(downloadBlob).mockImplementationOnce(() => {
      throw new Error('download blocked')
    })

    await expect(useAgentHandoff().copyBrief()).resolves.toBe(false)

    expect(useCopyToClipboard().copyToClipboard).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'error_copying_deploy_agent_brief',
      surface: 'platform'
    })
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        description:
          'The brief for your agent could not be prepared. Try again.',
        kind: 'error'
      })
    ])
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

    const brief = String(
      vi.mocked(useCopyToClipboard().copyToClipboard).mock.lastCall?.[0]
    )
    expect(brief).toContain('- `FreshClass`')
    expect(brief).not.toContain('StaleClass')
    const [, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(await blob.text()).toContain('FreshClass')
  })

  it('names the downloaded file exactly as the brief does, even for a name with a backtick', async () => {
    setActiveWorkflow('release`v2.json')

    await useAgentHandoff().copyBrief()

    expect(useCopyToClipboard().copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('downloaded the workflow as `releasev2.json`'),
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
