import { describe, expect, it } from 'vitest'

import rawDetails from '../src/data/hubTemplateDetails.json'
import rawTemplates from '../src/data/hubTemplates.json'
import type { HubTemplate } from '../src/lib/hub/types'
import { backfillTemplateMediaTypes } from './backfill-template-media-type'

const template: HubTemplate = {
  name: 'api_example',
  title: 'Example',
  mediaType: 'image',
  tags: ['Video'],
  models: [],
  logos: [],
  usage: 1,
  date: '2026-09-10',
  thumbnails: [],
  username: 'Comfy',
  isApp: false
}

describe('backfillTemplateMediaTypes', () => {
  it('accepts the committed template snapshots', () => {
    expect(() =>
      backfillTemplateMediaTypes(rawTemplates, rawDetails)
    ).not.toThrow()
  })

  it('validates snapshots before classifying media', () => {
    expect(() =>
      backfillTemplateMediaTypes([{ ...template, tags: 42 }], {})
    ).toThrow()
    expect(() =>
      backfillTemplateMediaTypes([template], { api_example: [] })
    ).toThrow()
    expect(() =>
      backfillTemplateMediaTypes([template], {
        api_example: { outputs: [], size: 'large' }
      })
    ).toThrow()
  })

  it('uses a valid detail output before the tag fallback', () => {
    const source = { ...template, snapshotMetadata: 'preserved' }
    const result = backfillTemplateMediaTypes([source], {
      api_example: { outputs: [{ mediaType: 'audio' }] }
    })

    expect(result).toEqual({
      index: [{ ...source, mediaType: 'audio' }],
      changed: 1
    })
  })
})
