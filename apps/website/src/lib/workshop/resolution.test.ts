import { describe, expect, it } from 'vitest'

import { workshopModels } from '@/config/workshop-browse-content'
import {
  normalizeResolution,
  parseResolution,
  resolutionsIn
} from './resolution'

describe('resolution', () => {
  it.for([
    ['720P', '720p'],
    ['720p', '720p'],
    ['2k', '2K'],
    ['4k', '4K'],
    ['1.5K', '1.5K'],
    ['hd', '720p'],
    ['FHD', '1080p'],
    ['2048x2048', undefined],
    ['16:9', undefined],
    ['auto', undefined]
  ] as const)('reads %s as %s', ([raw, expected]) => {
    expect(normalizeResolution(raw)).toBe(expected)
  })

  it('collects the resolutions a schema offers, highest first, in any nesting', () => {
    expect(
      resolutionsIn({
        allOf: [
          { properties: { resolution: { enum: ['480P', '1080P', '720p'] } } },
          {
            properties: {
              size: { enum: ['2K', '1024x1024', '1:1'] },
              aspect_ratio: { enum: ['4k'] }
            }
          }
        ]
      })
    ).toEqual(['2K', '1080p', '720p', '480p'])
  })

  it.for([
    ['?resolution=1080P', '1080p'],
    ['?resolution=8k', undefined],
    ['', undefined]
  ] as const)('reads the address %s as %s', ([search, expected]) => {
    expect(parseResolution(search)).toBe(expected)
  })

  it('gives the published catalogue its resolutions from the run forms', () => {
    const covered = workshopModels.filter(
      (model) => model.resolutions?.length
    ).length
    expect(covered).toBeGreaterThan(40)
    expect(
      workshopModels.find(
        (model) => model.slug === 'byteplus--seedream-5-pro--generate-images'
      )?.resolutions
    ).toBeDefined()
  })
})
