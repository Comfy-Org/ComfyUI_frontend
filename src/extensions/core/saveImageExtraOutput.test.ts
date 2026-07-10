import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'

const { app } = vi.hoisted(() => ({
  app: {
    registerExtension: vi.fn(),
    graph: undefined as unknown as LGraph
  }
}))

vi.mock('@/scripts/app', () => ({ app }))

type BeforeRegisterNodeDef = NonNullable<
  ComfyExtension['beforeRegisterNodeDef']
>

interface FilenamePrefixWidget {
  name: string
  value: unknown
  serializeValue?: () => string
}

async function loadExtension(): Promise<ComfyExtension> {
  vi.resetModules()
  app.registerExtension.mockClear()
  await import('./saveImageExtraOutput')
  return app.registerExtension.mock.calls[0][0] as ComfyExtension
}

async function createNodeWithFilenamePrefix(
  nodeName: string,
  prefix: string
): Promise<FilenamePrefixWidget> {
  const ext = await loadExtension()

  const nodeType = {
    prototype: {}
  } as unknown as Parameters<BeforeRegisterNodeDef>[0]
  const nodeData = { name: nodeName } as ComfyNodeDef

  await ext.beforeRegisterNodeDef!(
    nodeType,
    nodeData,
    {} as Parameters<BeforeRegisterNodeDef>[2]
  )

  const widget: FilenamePrefixWidget = {
    name: 'filename_prefix',
    value: prefix
  }
  const node = { widgets: [widget] }
  const proto = nodeType.prototype as { onNodeCreated?: () => void }
  proto.onNodeCreated!.call(node)

  return widget
}

describe('Comfy.SaveImageExtraOutput', () => {
  beforeEach(() => {
    const graph = new LGraph()
    graph.add({
      properties: { 'Node name for S&R': 'Sampler' },
      widgets: [{ name: 'seed', value: 12345 }]
    } as unknown as LGraphNode)
    app.graph = graph
  })

  it.each([
    'SaveImage',
    'SaveImageAdvanced',
    'SaveSVGNode',
    'SaveVideo',
    'SaveAnimatedWEBP',
    'SaveWEBM',
    'SaveAudio',
    'SaveAudioMP3',
    'SaveAudioOpus',
    'SaveAudioAdvanced',
    'SaveGLB',
    'Save3DAdvanced',
    'SaveGaussianSplat',
    'SavePointCloud',
    'SaveAnimatedPNG',
    'CLIPSave',
    'VAESave',
    'ModelSave',
    'LoraSave',
    'SaveLatent'
  ])(
    'resolves text replacements in the filename_prefix of %s on serialize',
    async (nodeName) => {
      const widget = await createNodeWithFilenamePrefix(
        nodeName,
        'ComfyUI_%Sampler.seed%'
      )

      expect(widget.serializeValue!()).toBe('ComfyUI_12345')
    }
  )
})
