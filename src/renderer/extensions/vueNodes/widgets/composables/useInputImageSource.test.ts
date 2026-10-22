import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { useInputImageSource } from './useInputImageSource'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

function buildGraph() {
  const graph = new LGraph()

  const target = new LGraphNode('CropByBBoxes')
  target.addInput('image', 'IMAGE')
  graph.add(target)

  const image = new LGraphNode('LoadImage')
  image.addOutput('IMAGE', 'IMAGE')
  graph.add(image)

  return { target, image }
}

const LIVE_URL = '/api/view?filename=live.png&type=input'
const SAVED_URL = '/api/view?filename=saved.png&type=temp'

describe('useInputImageSource with preferSaved', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    useNodeOutputStore().resetAllOutputsAndPreviews()
  })

  it.for([
    {
      name: 'the saved frame over the producer preview',
      connected: true,
      preview: true,
      saved: true,
      expected: SAVED_URL
    },
    {
      name: 'the producer preview before the node has run',
      connected: true,
      preview: true,
      saved: false,
      expected: LIVE_URL
    },
    {
      name: 'nothing once disconnected',
      connected: false,
      preview: true,
      saved: true,
      expected: undefined
    }
  ])('shows $name', ({ connected, preview, saved, expected }) => {
    const { target, image } = buildGraph()
    if (connected) image.connect(0, target, 0)
    const { url } = useInputImageSource(
      computed(() => target),
      'image',
      'source_images',
      { preferSaved: true }
    )
    if (preview)
      useNodeOutputStore().nodeOutputs[String(image.id)] = {
        images: [{ filename: 'live.png', type: 'input' }]
      }
    if (saved)
      useNodeOutputStore().nodeOutputs[String(target.id)] = {
        source_images: [{ filename: 'saved.png', type: 'temp' }]
      }

    expect(url.value).toBe(expected)
  })
})
