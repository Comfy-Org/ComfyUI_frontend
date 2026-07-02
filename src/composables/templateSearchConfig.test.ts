import { describe, expect, it } from 'vitest'

import {
  createTemplateSearchIndex,
  expandAbbreviation,
  expandQuery,
  searchTemplates,
  termFuzziness,
  tokenize
} from '@/composables/templateSearchConfig'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

const buildTemplate = (
  overrides: Partial<TemplateInfo> & { name: string }
): TemplateInfo => ({
  description: '',
  mediaType: 'image',
  mediaSubtype: 'png',
  ...overrides
})

describe('tokenize', () => {
  it('splits identifiers on hyphen and underscore', () => {
    expect(tokenize('video_ltx2_3_t2v')).toEqual([
      'video_ltx2_3_t2v',
      'video',
      'ltx2',
      '3',
      't2v'
    ])
  })

  it('splits a trailing version off its name so "wan 2.7" matches "wan2.7"', () => {
    expect(tokenize('wan2.7')).toEqual(['wan2.7', 'wan', '2.7'])
  })

  it('keeps a mid-digit abbreviation whole', () => {
    expect(tokenize('t2v')).toEqual(['t2v'])
  })

  it('lowercases and drops empty tokens', () => {
    expect(tokenize('  Flux   Kontext ')).toEqual(['flux', 'kontext'])
  })
})

describe('termFuzziness', () => {
  it('is exact for short terms (≤3 chars)', () => {
    expect(termFuzziness('t2v')).toBe(false)
    expect(termFuzziness('cn')).toBe(false)
  })

  it('is exact for any term containing a digit so versions do not blur', () => {
    expect(termFuzziness('2.5')).toBe(false)
    expect(termFuzziness('flux2')).toBe(false)
  })

  it('allows edits for longer alphabetic terms', () => {
    expect(termFuzziness('control')).toBe(0.3)
  })
})

describe('expandAbbreviation', () => {
  it('expands cross-modality shorthand', () => {
    expect(expandAbbreviation('t2i')).toBe('text image')
    expect(expandAbbreviation('i2v')).toBe('image video')
    expect(expandAbbreviation('txt2img')).toBe('text image')
  })

  it('collapses same-modality pairs instead of duplicating', () => {
    expect(expandAbbreviation('img2img')).toBe('image')
    expect(expandAbbreviation('v2v')).toBe('video')
  })

  it('expands known acronyms', () => {
    expect(expandAbbreviation('cn')).toBe('controlnet')
  })

  it('returns null for unknown tokens and unknown modalities', () => {
    expect(expandAbbreviation('flux')).toBeNull()
    expect(expandAbbreviation('x2y')).toBeNull()
  })
})

describe('expandQuery', () => {
  it('expands shorthand tokens within a multi-word query', () => {
    expect(expandQuery('wan i2v')).toBe('wan image video')
  })

  it('returns null when nothing expands', () => {
    expect(expandQuery('flux upscale')).toBeNull()
  })
})

describe('searchTemplates', () => {
  const buildIndex = (templates: TemplateInfo[]) =>
    createTemplateSearchIndex(templates)

  it('returns an empty array for a blank query without touching the index', () => {
    const index = buildIndex([buildTemplate({ name: 'a', title: 'Alpha' })])
    expect(searchTemplates(index, '   ')).toEqual([])
  })

  it('matches a prefix ("vid" → "video")', () => {
    const index = buildIndex([
      buildTemplate({ name: 'video', title: 'Video Generator' }),
      buildTemplate({ name: 'audio', title: 'Audio Studio' })
    ])
    expect(searchTemplates(index, 'vid')).toContain('video')
    expect(searchTemplates(index, 'vid')).not.toContain('audio')
  })

  it('tolerates a typo in a longer term ("contorlnet")', () => {
    const index = buildIndex([
      buildTemplate({
        name: 'cn',
        title: 'Union ControlNet',
        tags: ['ControlNet']
      })
    ])
    expect(searchTemplates(index, 'contorlnet')).toContain('cn')
  })

  it('requires all words to match (AND) before falling back to OR', () => {
    const index = buildIndex([
      buildTemplate({
        name: 'both',
        title: 'Flux Upscale',
        models: ['Flux'],
        tags: ['Upscale']
      }),
      buildTemplate({ name: 'flux_only', title: 'Flux Text to Image' })
    ])
    expect(searchTemplates(index, 'flux upscale')[0]).toBe('both')
  })

  it('breaks a near-tie by higher usage', () => {
    const index = buildIndex([
      buildTemplate({ name: 'low', title: 'Alpha Upscale', usage: 1 }),
      buildTemplate({ name: 'high', title: 'Beta Upscale', usage: 5000 })
    ])
    expect(searchTemplates(index, 'upscale')[0]).toBe('high')
  })

  it('does not let usage override a clearly stronger text match', () => {
    const index = buildIndex([
      buildTemplate({ name: 'exact', title: 'Outpaint', usage: 1 }),
      buildTemplate({
        name: 'weak',
        title: 'Portrait',
        description: 'has an outpaint option somewhere',
        usage: 9000
      })
    ])
    expect(searchTemplates(index, 'outpaint')[0]).toBe('exact')
  })

  it('deduplicates literal and expansion matches, keeping the literal first', () => {
    const index = buildIndex([
      buildTemplate({ name: 'literal', title: 'Wan T2V', tags: ['T2V'] }),
      buildTemplate({ name: 'expanded', title: 'Text to Video Studio' })
    ])
    const results = searchTemplates(index, 't2v')
    expect(results[0]).toBe('literal')
    expect(new Set(results).size).toBe(results.length)
  })

  it('indexes localized title/description over raw english', () => {
    const index = buildIndex([
      buildTemplate({
        name: 'localized',
        title: 'raw',
        localizedTitle: 'aquarela',
        description: 'raw',
        localizedDescription: 'pintura'
      })
    ])
    expect(searchTemplates(index, 'aquarela')).toEqual(['localized'])
    expect(searchTemplates(index, 'pintura')).toEqual(['localized'])
  })

  it('falls back to the name when a template has no title or description', () => {
    const index = buildIndex([buildTemplate({ name: 'flux_kontext_edit' })])
    expect(searchTemplates(index, 'kontext')).toEqual(['flux_kontext_edit'])
  })
})
