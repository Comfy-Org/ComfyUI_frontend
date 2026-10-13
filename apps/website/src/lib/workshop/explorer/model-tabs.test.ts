import { describe, expect, it } from 'vitest'

import { workshopModels } from '@/config/workshop-browse-content'
import type { ModelTab } from './model-tabs'
import { hostedInTab, MODEL_TABS, parseModelTab } from './model-tabs'

const hosted = workshopModels

function hostedSlugs(tab: ModelTab) {
  return hosted
    .filter((model) => hostedInTab(model, tab))
    .map((model) => model.slug)
}

describe('category tabs over the real catalogue', () => {
  it.for([
    { tab: 'image', hosted: 'bfl--flux-2-max--generate-images' },
    { tab: 'video', hosted: 'bfl--flux-3-text-to-video--generate-videos' },
    { tab: 'audio', hosted: 'elevenlabs--text-to-dialogue--audio' },
    { tab: 'edit', hosted: 'beeble--switchx-image-edit--edit-images' },
    { tab: 'upscale', hosted: 'wavespeed--flashvsr--edit-videos' }
  ] as const)('$tab holds models of that kind', (row) => {
    expect(hostedSlugs(row.tab)).toContain(row.hosted)
  })

  it('keeps each media tab to models that make that medium', () => {
    expect(hostedSlugs('audio')).not.toContain(
      'bfl--flux-2-max--generate-images'
    )
  })

  it('leaves models that do not upscale out of the upscale tab', () => {
    expect(hostedSlugs('upscale')).not.toContain(
      'bfl--flux-2-max--generate-images'
    )
  })

  it('lists every hosted model under All', () => {
    expect(hostedSlugs('all')).toHaveLength(hosted.length)
  })

  it('offers no Open weights or Partner nodes tab', () => {
    expect(MODEL_TABS).not.toContain('open')
    expect(MODEL_TABS).not.toContain('partner')
  })
})

describe('parseModelTab', () => {
  it.for([
    ['?tab=video', 'video'],
    ['?q=flux&tab=edit', 'edit'],
    ['?tab=3d', '3d'],
    ['?tab=open', 'all'],
    ['?tab=partner', 'all'],
    ['?tab=unknown', 'all'],
    ['', 'all']
  ] as const)('reads %s as %s', ([search, tab]) => {
    expect(parseModelTab(search)).toBe(tab)
  })

  it('knows every tab it offers', () => {
    for (const tab of MODEL_TABS) expect(parseModelTab(`?tab=${tab}`)).toBe(tab)
  })
})
