import { describe, expect, it } from 'vitest'

import { LAUNCH_CATEGORIES } from '../../config/workshop-launch'
import { hubWorkflowPath } from './catalogue-entries'
import { runsHere } from './runs-here'
import {
  getHubWorkflowPage,
  listHubWorkflows,
  summarisePorts
} from './workflow-detail'

describe('getHubWorkflowPage', () => {
  it('returns nothing for an unknown template', () => {
    expect(getHubWorkflowPage('no-such-template')).toBeUndefined()
  })

  it('gives every workflow in the launch list a page of its own', () => {
    const listed = LAUNCH_CATEGORIES.flatMap((category) =>
      category.workflows.map((workflow) => workflow.template)
    )

    expect(
      listHubWorkflows()
        .map((t) => t.name)
        .sort()
    ).toEqual([...listed].sort())
    expect(listed.every((name) => getHubWorkflowPage(name))).toBe(true)
    expect(hubWorkflowPath('video_ltx2_3_i2v')).toBe(
      '/hub/workflow/video_ltx2_3_i2v/'
    )
  })

  // The catalogue is chosen editorially now, so weights and custom nodes are
  // ordinary: Cloud holds them. What still has to hold is that a page which
  // offers an inline run is one the Router can actually serve.
  it('offers an inline run only where the Router carries the model', () => {
    const pages = listHubWorkflows().map((template) => ({
      template,
      page: getHubWorkflowPage(template.name)!
    }))

    for (const { template, page } of pages)
      expect(page.runsInline).toBe(runsHere(template))

    // Naming a model is not the same as being runnable: a graph can reach a
    // model the Router carries and still need custom nodes around it.
    expect(pages.some(({ page }) => page.destination && !page.runsInline)).toBe(
      true
    )

    expect(pages.some(({ page }) => page.weightsBytes > 0)).toBe(true)
  })

  // Some registry rows list the maker beside the model it made, which reads on
  // the page as a graph calling two models rather than one.
  it('leaves the maker out of the models a workflow runs on', () => {
    const page = getHubWorkflowPage('templates-character_sheet')!

    expect(page.runsOn.map((ref) => ref.name)).not.toContain('Google')
  })

  // A graph outside the launch list has no page at all, whatever the registry
  // still ships under that name.
  it.for([
    'video_minimax_h3_i2v',
    'api_nano_banana_pro',
    'video_ltx_2_audio_to_video'
  ])('has no page for %s, which the launch list leaves out', (name) => {
    expect(getHubWorkflowPage(name)).toBeUndefined()
  })

  it('reads the ports the details declare, and falls back to the medium', () => {
    const withPorts = getHubWorkflowPage('flux_fill_inpaint_example')!

    expect(withPorts.inputs.length).toBeGreaterThan(0)
    expect(withPorts.mediaType).toBe('image')
  })

  it('never recommends the workflow itself', () => {
    const page = getHubWorkflowPage('video_ltx2_3_i2v')!

    expect(page.related.length).toBeGreaterThan(0)
    expect(page.related.map((other) => other.name)).not.toContain(
      'video_ltx2_3_i2v'
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
