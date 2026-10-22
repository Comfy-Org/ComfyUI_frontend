import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { useTextOverlaySources } from './useTextOverlaySources'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

function buildGraph() {
  const graph = new LGraph()

  const target = new LGraphNode('TextOverlay')
  target.addInput('images', 'IMAGE')
  graph.add(target)

  const image = new LGraphNode('LoadImage')
  image.addOutput('IMAGE', 'IMAGE')
  graph.add(image)

  const decode = new LGraphNode('VAEDecode')
  decode.addOutput('IMAGE', 'IMAGE')
  graph.add(decode)

  return { target, image, decode }
}

describe('useTextOverlaySources', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    useNodeOutputStore().resetAllOutputsAndPreviews()
  })

  it.for([
    {
      name: 'the upstream preview over the reported source frame',
      connected: true,
      preview: true,
      saved: true,
      expected: '/api/view?filename=live.png&type=input'
    },
    {
      name: 'the reported source frame when upstream has no preview',
      connected: true,
      preview: false,
      saved: true,
      expected: '/api/view?filename=source.png&type=temp'
    },
    {
      name: 'nothing when neither has an image',
      connected: true,
      preview: false,
      saved: false,
      expected: undefined
    },
    {
      name: 'nothing once the images input is disconnected',
      connected: false,
      preview: true,
      saved: true,
      expected: undefined
    }
  ])('previews on $name', ({ connected, preview, saved, expected }) => {
    const { target, image } = buildGraph()
    if (connected) image.connect(0, target, 0)
    if (preview)
      useNodeOutputStore().nodeOutputs[String(image.id)] = {
        images: [{ filename: 'live.png', type: 'input' }]
      }
    if (saved)
      useNodeOutputStore().nodeOutputs[String(target.id)] = {
        source_images: [{ filename: 'source.png', type: 'temp' }]
      }

    const { sourceUrl } = useTextOverlaySources(computed(() => target))

    expect(sourceUrl.value).toBe(expected)
  })

  it('drops the reported source frame after rewiring to another producer', () => {
    const { target, image, decode } = buildGraph()
    image.connect(0, target, 0)
    const { sourceUrl } = useTextOverlaySources(computed(() => target))
    useNodeOutputStore().nodeOutputs[String(target.id)] = {
      source_images: [{ filename: 'from_image.png', type: 'temp' }]
    }
    const saved = '/api/view?filename=from_image.png&type=temp'
    expect(sourceUrl.value).toBe(saved)

    decode.connect(0, target, 0)
    expect(sourceUrl.value).toBeUndefined()

    image.connect(0, target, 0)
    expect(sourceUrl.value).toBe(saved)
  })
})
