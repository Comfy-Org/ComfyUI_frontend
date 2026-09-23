import { describe, expect, it } from 'vitest'

import { workshopModels } from '../../config/workshop-browse-content'
import { facetedTemplates } from './page-data'
import hubTemplates from '../../data/hubTemplates.json'
import { runsHere } from './runs-here'
import { listHubWorkflows } from './workflow-detail'

const templates = facetedTemplates(hubTemplates, workshopModels)
const named = (name: string) => templates.find((entry) => entry.name === name)!

describe('runsHere', () => {
  // It answers one narrow question: can the page run this inline, as a form
  // and a Run button, through a single Router call? A graph that loads weights
  // or carries custom nodes runs on Cloud instead.
  it.for([
    ['api_nano_banana_pro', true],
    ['utility_seedvr2_image_upscale', false],
    ['flux_fill_inpaint_example', false]
  ] as const)('answers %s', ([name, expected]) => {
    expect(runsHere(named(name))).toBe(expected)
  })

  // The catalogue is the launch list, chosen editorially. Most of it runs on
  // Cloud, so this rule decides which cards additionally open onto a form.
  it('no longer decides what the catalogue holds', () => {
    const workflows = listHubWorkflows()
    const inline = workflows.filter(runsHere)

    expect(workflows.length).toBeGreaterThan(inline.length)
    expect(inline.length).toBeGreaterThan(0)
  })
})
