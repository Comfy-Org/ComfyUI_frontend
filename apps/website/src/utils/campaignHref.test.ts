import { describe, expect, it } from 'vitest'

import { campaignHref } from './campaignHref'

const PAGE_URL =
  'https://comfy.org/vfx/?utm_source=linkedin&utm_campaign=vfx&email=private&interest=other'

describe('campaign destinations', () => {
  it.for([
    [
      '/contact/?interest=vfx',
      '/contact/?interest=vfx&utm_source=linkedin&utm_campaign=vfx'
    ],
    [
      'https://comfy.org/workflows/storyboard/',
      'https://comfy.org/workflows/storyboard/?utm_source=linkedin&utm_campaign=vfx'
    ],
    [
      'https://cloud.comfy.org/?utm_source=comfy_org',
      'https://cloud.comfy.org/?utm_source=comfy_org&utm_campaign=vfx'
    ],
    ['https://example.com/', 'https://example.com/'],
    ['mailto:hello@comfy.org', 'mailto:hello@comfy.org'],
    ['#workflows', '#workflows']
  ])('carries campaign context safely to %s', ([href, expected]) => {
    expect(campaignHref(href, PAGE_URL)).toBe(expected)
  })
})
