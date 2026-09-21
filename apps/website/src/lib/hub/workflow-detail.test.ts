import { describe, expect, it } from 'vitest'

import { hubWorkflowPath } from './catalogue-entries'
import {
  formatWeights,
  getHubWorkflowPage,
  listHubWorkflows,
  summarisePorts
} from './workflow-detail'

describe('getHubWorkflowPage', () => {
  it('returns nothing for an unknown template', () => {
    expect(getHubWorkflowPage('no-such-template')).toBeUndefined()
  })

  it('gives every template in the snapshot a page of its own', () => {
    expect(listHubWorkflows().length).toBeGreaterThan(600)
    expect(hubWorkflowPath('api_nano_banana_pro')).toBe(
      '/playground/workflow/api_nano_banana_pro/'
    )
  })

  it('offers a destination only where the catalogue carries the model', () => {
    const routed = getHubWorkflowPage('api_nano_banana_pro')!
    expect(routed.callsPartnerModel).toBe(true)
    expect(routed.destination?.name).toBe('Nano Banana Pro')

    const absent = getHubWorkflowPage('api_minimax_h3_max_flf2v')!
    expect(absent.callsPartnerModel).toBe(true)
    expect(absent.destination).toBeUndefined()
    expect(absent.runsOn).toEqual([{ name: 'MiniMax H3', model: undefined }])
  })

  it('separates a partner workflow from one that downloads weights', () => {
    expect(getHubWorkflowPage('api_minimax_h3_max_flf2v')!.weightsBytes).toBe(0)

    const local = getHubWorkflowPage('video_minimax_h3_i2v')!
    expect(local.callsPartnerModel).toBe(false)
    expect(local.destination).toBeUndefined()
    expect(local.weightsBytes).toBeGreaterThan(0)
  })

  it('lists the custom nodes a workflow declares, and none otherwise', () => {
    expect(
      getHubWorkflowPage('video_ltx_2_audio_to_video')!.customNodes.length
    ).toBeGreaterThan(0)
    expect(getHubWorkflowPage('image_z_image_turbo')!.customNodes).toEqual([])
  })

  it('reads the ports the details declare, and falls back to the medium', () => {
    const withPorts = getHubWorkflowPage('video_minimax_h3_i2v')!
    expect(withPorts.inputs).toContainEqual({
      name: 'LoadImage',
      type: 'image'
    })
    expect(withPorts.mediaType).toBe('video')

    const noOutputs = getHubWorkflowPage('api_minimax_h3_max_flf2v')!
    expect(noOutputs.outputs).toEqual([{ name: 'video', type: 'video' }])
  })

  it('recommends only the same kind, and never the workflow itself', () => {
    const page = getHubWorkflowPage('video_minimax_h3_i2v')!
    expect(page.related).toHaveLength(8)
    expect(page.related.every((other) => !other.isApp)).toBe(true)
    expect(page.related.map((other) => other.name)).not.toContain(
      'video_minimax_h3_i2v'
    )
  })

  // An app is a form somebody finished; a node graph is one to open and edit.
  // Recommending across that line offers the reader the wrong kind of thing.
  it('recommends an app only other apps', () => {
    const page = getHubWorkflowPage('templates-qwen_multiangle.app')!
    expect(page.related.length).toBeGreaterThan(0)
    expect(page.related.every((other) => other.isApp)).toBe(true)
  })
})

describe('formatWeights', () => {
  it.for([
    [0, undefined],
    [-1, undefined],
    [800_000_000, '800 MB'],
    [1_000_000_000, '1 GB'],
    [6_400_000_000, '6 GB'],
    // Rounded to what a reader decides on: 6.5 GB of disk or not.
    [6_500_000_000, '7 GB']
  ] as const)('reads %s bytes as %s', ([bytes, size]) => {
    expect(formatWeights(bytes)).toBe(size)
  })
})

describe('summarisePorts', () => {
  // Three LoadImage nodes are one thing to bring, three times over.
  it('counts the ports by medium rather than by node', () => {
    expect(
      summarisePorts([
        { name: 'LoadImage', type: 'image' },
        { name: 'LoadImage 2', type: 'image' },
        { name: 'LoadAudio', type: 'audio' }
      ])
    ).toEqual([
      { media: 'image', count: 2 },
      { media: 'audio', count: 1 }
    ])
  })

  it('has nothing to say about a graph that loads nothing', () => {
    expect(summarisePorts([])).toEqual([])
  })
})
