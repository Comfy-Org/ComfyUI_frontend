import { describe, expect, it } from 'vitest'

import { workshopModels } from '@/config/workshop-browse-content'
import type { ModelTab } from './model-tabs'
import {
  hostedInTab,
  MODEL_TABS,
  openWeightInTab,
  parseModelTab
} from './model-tabs'
import { OPEN_WEIGHT_MODELS } from './open-weight-models'

const hosted = workshopModels

function hostedSlugs(tab: ModelTab) {
  return hosted
    .filter((model) => hostedInTab(model, tab))
    .map((model) => model.slug)
}

function openWeightSlugs(tab: ModelTab) {
  return OPEN_WEIGHT_MODELS.filter((model) => openWeightInTab(model, tab)).map(
    (model) => model.slug
  )
}

describe('category tabs over the real catalogue', () => {
  it.for([
    {
      tab: 'image',
      hosted: 'bfl--flux-2-max--generate-images',
      openWeight: 'flux1-dev'
    },
    {
      tab: 'video',
      hosted: 'bfl--flux-3-text-to-video--generate-videos',
      openWeight: 'wan2-2-ti2v-5b-fp16'
    },
    {
      tab: 'audio',
      hosted: 'elevenlabs--text-to-dialogue--audio',
      openWeight: 'stable-audio-open-1-0'
    },
    { tab: '3d', openWeight: 'trellis-2-int8-convrot' },
    {
      tab: 'edit',
      hosted: 'beeble--switchx-image-edit--edit-images',
      openWeight: 'qwen-image-edit-2511-bf16'
    },
    {
      tab: 'upscale',
      hosted: 'wavespeed--flashvsr--edit-videos',
      openWeight: 'seedvr2-3b-int8-convrot'
    }
  ] as const)('$tab holds models of that kind from both sources', (row) => {
    if ('hosted' in row) expect(hostedSlugs(row.tab)).toContain(row.hosted)
    expect(openWeightSlugs(row.tab)).toContain(row.openWeight)
  })

  it('keeps each media tab to models that make that medium', () => {
    expect(openWeightSlugs('image')).not.toContain('wan2-2-ti2v-5b-fp16')
    expect(openWeightSlugs('video')).not.toContain('flux1-dev')
    expect(hostedSlugs('audio')).not.toContain(
      'bfl--flux-2-max--generate-images'
    )
  })

  it('leaves models that do not upscale out of the upscale tab', () => {
    expect(hostedSlugs('upscale')).not.toContain(
      'bfl--flux-2-max--generate-images'
    )
    expect(openWeightSlugs('upscale')).not.toContain('flux1-dev')
  })

  it('splits the catalogue into open weights and partner nodes', () => {
    expect(openWeightSlugs('open')).toHaveLength(OPEN_WEIGHT_MODELS.length)
    expect(hostedSlugs('open')).toEqual([])
    expect(hostedSlugs('partner')).toHaveLength(hosted.length)
    expect(openWeightSlugs('partner')).toEqual([])
  })

  it('lists everything under All', () => {
    expect(hostedSlugs('all')).toHaveLength(hosted.length)
    expect(openWeightSlugs('all')).toHaveLength(OPEN_WEIGHT_MODELS.length)
  })
})

describe('parseModelTab', () => {
  it.for([
    ['?tab=video', 'video'],
    ['?q=flux&tab=open', 'open'],
    ['?tab=3d', '3d'],
    ['?tab=unknown', 'all'],
    ['', 'all']
  ] as const)('reads %s as %s', ([search, tab]) => {
    expect(parseModelTab(search)).toBe(tab)
  })

  it('knows every tab it offers', () => {
    for (const tab of MODEL_TABS) expect(parseModelTab(`?tab=${tab}`)).toBe(tab)
  })
})
