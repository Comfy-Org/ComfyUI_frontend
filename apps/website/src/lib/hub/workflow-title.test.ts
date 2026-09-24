import { describe, expect, it } from 'vitest'

import { LAUNCH_CATEGORIES } from '../../config/workshop-launch'
import { listHubWorkflows } from './workflow-detail'
import { workflowDisplayTitle } from './workflow-title'

const titleOf = (name: string) =>
  workflowDisplayTitle(listHubWorkflows().find((t) => t.name === name)!)

describe('workflowDisplayTitle', () => {
  // A card says the job the visitor came for. The template behind it is how
  // that job is served, which is the page's business rather than the card's.
  it.for([
    ['video_ltx2_3_i2v', 'Turn an image into a video'],
    ['utility_seedvr2_image_upscale', 'Upscale and restore detail'],
    ['api_bria_eraser', 'Remove an object']
  ] as const)('names %s after the job, not the model', ([name, expected]) => {
    expect(titleOf(name)).toBe(expected)
  })

  // A name the registry wrote for itself is a name nobody asked for.
  it('leaves no workflow in the Hub with a name nobody wrote', () => {
    const unwritten = listHubWorkflows().filter(
      (template) => workflowDisplayTitle(template) === template.title
    )

    expect(unwritten).toEqual([])
  })

  it('names every workflow the launch list carries', () => {
    const outcomes = LAUNCH_CATEGORIES.flatMap((category) =>
      category.workflows.map((workflow) => workflow.outcome)
    )

    expect(listHubWorkflows().map(workflowDisplayTitle).sort()).toEqual(
      [...outcomes].sort()
    )
  })
})
