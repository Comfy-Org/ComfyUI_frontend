import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { NodeExecutionOutput } from '@/platform/remote/comfyui/execution/types'
import type { DOMWidget } from '@/scripts/domWidget'
import { toNodeId } from '@/types/nodeId'

import { collectMediaUiDiagnostics } from './mediaUiDiagnostics'

function mediaNode(
  id: number,
  comfyClass: string,
  widgets: readonly IBaseWidget[]
): LGraphNode {
  const node = new LGraphNode(comfyClass)
  node.id = toNodeId(id)
  node.comfyClass = comfyClass
  node.widgets = [...widgets]
  return node
}

describe('collectMediaUiDiagnostics', () => {
  it('records privacy-safe state across output, legacy, Vue and DOM-widget layers', () => {
    const image = mediaNode(7, 'LoadImage', [
      fromPartial<IBaseWidget>({ name: 'image', value: 'private-name.png' })
    ])
    const loadedImage = new Image()
    Object.defineProperties(loadedImage, {
      complete: { value: true },
      naturalWidth: { value: 512 }
    })
    image.imgs = [loadedImage]

    const audioElement = document.createElement('audio')
    audioElement.src = 'https://private.example/audio.wav'
    const audio = mediaNode(9, 'LoadAudio', [
      fromPartial<IBaseWidget>({ name: 'audio', value: 'private-audio.wav' }),
      fromPartial<DOMWidget<HTMLAudioElement, string>>({
        name: 'audioUI',
        element: audioElement
      })
    ])

    const imageRoot = document.createElement('div')
    imageRoot.dataset.nodeId = '7'
    imageRoot.append(document.createElement('img'))
    const audioRoot = document.createElement('div')
    audioRoot.dataset.nodeId = '9'
    audioRoot.append(audioElement)
    document.body.append(imageRoot, audioRoot)

    const outputs = new Map<LGraphNode, NodeExecutionOutput>([
      [image, { images: [{ filename: 'private-output.png' }] }],
      [audio, { audio: [{ filename: 'private-output.wav' }] }]
    ])
    const diagnostics = collectMediaUiDiagnostics({
      nodes: [image, audio],
      getNodeOutputs: (node) => outputs.get(node),
      getNodeImageUrls: (node) =>
        node === image ? ['https://private.example/image.png'] : undefined,
      root: document
    })

    expect(diagnostics).toEqual([
      expect.objectContaining({
        nodeId: '7',
        mediaKinds: ['image'],
        selectedImagePresent: true,
        outputImageCount: 1,
        resolvedImageUrlCount: 1,
        legacyImageCount: 1,
        loadedLegacyImageCount: 1,
        vueNodeCount: 1,
        vueImageCount: 1
      }),
      expect.objectContaining({
        nodeId: '9',
        mediaKinds: ['audio'],
        selectedAudioPresent: true,
        outputAudioCount: 1,
        vueAudioCount: 1,
        audioUiRegistered: true,
        audioElementConnected: true,
        audioSourcePresent: true
      })
    ])
    expect(JSON.stringify(diagnostics)).not.toMatch(
      /private-name|private-audio|private-output|private\.example/
    )
  })

  it('omits nodes with no media evidence', () => {
    const node = mediaNode(1, 'KSampler', [])

    expect(
      collectMediaUiDiagnostics({
        nodes: [node],
        getNodeOutputs: () => undefined,
        getNodeImageUrls: () => undefined,
        root: document
      })
    ).toEqual([])
  })

  it('includes nodes whose only media evidence is rendered UI', () => {
    const node = mediaNode(5, 'PreviewNode', [])
    const host = document.createElement('div')
    const root = document.createElement('div')
    root.dataset.nodeId = '5'
    root.append(document.createElement('img'))
    host.append(root)

    expect(
      collectMediaUiDiagnostics({
        nodes: [node],
        getNodeOutputs: () => undefined,
        getNodeImageUrls: () => undefined,
        root: host
      })
    ).toEqual([
      expect.objectContaining({
        nodeId: '5',
        mediaKinds: ['image'],
        vueImageCount: 1
      })
    ])
  })
})
