import { describe, expect, it } from 'vitest'

import { hubWorkflowPath } from './catalogue-entries'
import {
  getHubWorkflowPage,
  listHubWorkflows,
  summarisePorts,
  workflowJobTitle
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

  it('never recommends the workflow itself', () => {
    const page = getHubWorkflowPage('video_minimax_h3_i2v')!
    expect(page.related).toHaveLength(8)
    expect(page.related.map((other) => other.name)).not.toContain(
      'video_minimax_h3_i2v'
    )
  })
})

describe('workflowJobTitle', () => {
  // The registry writes "<model>: <operation>", so the name says which model
  // runs before it says what the reader gets.
  it.for([
    ['api_nano_banana_pro', 'Nano Banana Pro'],
    ['api_google_nano_banana2_image_edit', 'Nano Banana 2'],
    ['video_minimax_h3_i2v', 'MiniMax H3']
  ] as const)('reads the model out of %s', ([name, model]) => {
    expect(workflowJobTitle(getHubWorkflowPage(name)!)?.model).toBe(model)
  })

  // A title that already leads with the job is the shape we want, so it keeps
  // the words somebody chose for it.
  it('leaves a title that already names its job', () => {
    const page = getHubWorkflowPage('utility_seedvr2_3b_int8_upscale_video')!

    expect(page.template.title).toMatch(/^Video Upscale/)
    expect(workflowJobTitle(page)).toBeUndefined()
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
