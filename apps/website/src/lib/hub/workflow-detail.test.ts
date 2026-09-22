import { describe, expect, it } from 'vitest'

import { hubWorkflowPath } from './catalogue-entries'
import {
  getHubWorkflowPage,
  listHubWorkflows,
  summarisePorts
} from './workflow-detail'

describe('getHubWorkflowPage', () => {
  it('returns nothing for an unknown template', () => {
    expect(getHubWorkflowPage('no-such-template')).toBeUndefined()
  })

  it('gives every workflow that runs here a page of its own', () => {
    expect(listHubWorkflows().length).toBeGreaterThan(20)
    expect(hubWorkflowPath('api_nano_banana_pro')).toBe(
      '/hub/workflow/api_nano_banana_pro/'
    )
  })

  // The catalogue holds only what this page can run, so every page in it
  // reaches one partner model, downloads nothing, and installs nothing.
  it('carries a destination, no weights and no custom nodes throughout', () => {
    const pages = listHubWorkflows().map((template) =>
      getHubWorkflowPage(template.name)!
    )

    expect(pages.every((page) => page.callsPartnerModel)).toBe(true)
    expect(pages.every((page) => page.destination !== undefined)).toBe(true)
    expect(pages.every((page) => page.weightsBytes === 0)).toBe(true)
    expect(pages.every((page) => page.customNodes.length === 0)).toBe(true)
  })

  it('names the model page a workflow can open', () => {
    const routed = getHubWorkflowPage('api_nano_banana_pro')!

    expect(routed.destination?.name).toBe('Nano Banana Pro')
    expect(routed.runsOn.map((ref) => ref.name)).toContain('Nano Banana Pro')
  })

  // Some registry rows list the maker beside the model it made, which reads on
  // the page as a graph calling two models rather than one.
  it('leaves the maker out of the models a workflow runs on', () => {
    const page = getHubWorkflowPage('api_google_nano_banana2_image_edit')!

    expect(page.runsOn.map((ref) => ref.name)).not.toContain('Google')
    expect(page.runsOn.map((ref) => ref.name)).toContain('Nano Banana 2')
  })

  // A graph the catalogue no longer holds has no page at all, whatever the
  // registry still ships under that name.
  it.for([
    'video_minimax_h3_i2v',
    'flux_fill_inpaint_example',
    'video_ltx_2_audio_to_video'
  ])('has no page for %s, which cannot run here', (name) => {
    expect(getHubWorkflowPage(name)).toBeUndefined()
  })

  it('reads the ports the details declare, and falls back to the medium', () => {
    const withPorts = getHubWorkflowPage('api_google_nano_banana2_image_edit')!
    expect(withPorts.inputs).toContainEqual({
      name: 'LoadImage',
      type: 'image'
    })
    expect(withPorts.mediaType).toBe('image')

    const noInputs = getHubWorkflowPage('api_bytedance_seedream_5_0_pro_t2i')!
    expect(noInputs.inputs).toEqual([])
  })

  it('never recommends the workflow itself', () => {
    const page = getHubWorkflowPage('api_nano_banana_pro')!

    expect(page.related.length).toBeGreaterThan(0)
    expect(page.related.map((other) => other.name)).not.toContain(
      'api_nano_banana_pro'
    )
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
