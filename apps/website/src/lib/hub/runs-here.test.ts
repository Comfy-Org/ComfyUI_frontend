import { describe, expect, it } from 'vitest'

import { listHubWorkflows } from './workflow-detail'
import { runsHere } from './runs-here'

describe('runsHere', () => {
  // A graph whose models have to be downloaded before it runs has nothing to
  // offer on a page whose whole promise is a form and a Run button.
  it.for([
    ['api_nano_banana_pro', true],
    ['utility_seedvr2_image_upscale', false],
    ['flux_fill_inpaint_example', false]
  ] as const)('answers %s', ([name, expected]) => {
    const template = listHubWorkflows().find((entry) => entry.name === name)
    expect(Boolean(template)).toBe(expected)
  })

  it('is what the catalogue is built from', () => {
    const workflows = listHubWorkflows()

    expect(workflows.length).toBeGreaterThan(0)
    expect(workflows.every(runsHere)).toBe(true)
  })
})
