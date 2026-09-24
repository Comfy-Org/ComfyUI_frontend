import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'
vi.mock(import('@/scripts/app'))

type BeforeRegisterNodeDef = NonNullable<
  ComfyExtension['beforeRegisterNodeDef']
>

interface FilenamePrefixWidget {
  name: string
  value: unknown
  serializeValue?: () => string
}

async function loadExtension(graph: LGraph): Promise<ComfyExtension> {
  vi.resetModules()
  const { app } = await import('@/scripts/app')
  vi.mocked(app).graph = graph
  const registerExtension = vi.mocked(app.registerExtension)
  await import('./saveImageExtraOutput')
  return registerExtension.mock.calls[0][0]
}

async function createNodeWithFilenamePrefix(
  nodeName: string,
  prefix: string
): Promise<FilenamePrefixWidget> {
  const graph = new LGraph()
  const sampler = new LGraphNode('Sampler')
  sampler.properties['Node name for S&R'] = 'Sampler'
  sampler.addWidget('number', 'seed', 12345, () => undefined, {})
  graph.add(sampler)

  const ext = await loadExtension(graph)

  const nodeType = fromPartial<Parameters<BeforeRegisterNodeDef>[0]>({
    prototype: {}
  })
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
  it.for([
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
