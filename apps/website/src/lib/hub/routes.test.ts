import { describe, expect, it } from 'vitest'

import {
  hubCreatorUrl,
  hubModelUrl,
  hubTagUrl,
  hubWorkflowsUrl
} from './routes'

describe('Hub link helpers', () => {
  it.for([
    ['the workflows index', () => hubWorkflowsUrl(), '/hub/workflows/'],
    [
      'a tag filter',
      () => hubWorkflowsUrl({ capability: 'Image Edit' }),
      '/hub/workflows/?capability=Image%20Edit'
    ],
    [
      'a search',
      () => hubWorkflowsUrl({ q: 'nano banana pro' }),
      '/hub/workflows/?q=nano%20banana%20pro'
    ],
    [
      'a tag',
      () => hubTagUrl('Visual Effects'),
      '/hub/workflows/?capability=Visual%20Effects'
    ],
    [
      'a tag stored under its original name',
      () => hubTagUrl('API'),
      '/hub/workflows/?capability=API'
    ],
    [
      'a tag with reserved characters',
      () => hubTagUrl('Image to 3D & Video'),
      '/hub/workflows/?capability=Image%20to%203D%20%26%20Video'
    ],
    ['a model family', () => hubModelUrl('wan'), '/hub/workflows/?q=wan'],
    ['a creator', () => hubCreatorUrl('comfyui'), '/hub/creators/comfyui/'],
    [
      'a creator name with reserved characters',
      () => hubCreatorUrl('rob/smith ?'),
      '/hub/creators/rob%2Fsmith%20%3F/'
    ]
  ] as const)('builds %s', ([, build, expected]) => {
    expect(build()).toBe(expected)
  })
})
