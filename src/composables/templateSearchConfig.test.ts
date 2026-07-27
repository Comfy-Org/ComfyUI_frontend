import { describe, expect, it } from 'vitest'

import type { SearchResult } from 'minisearch'

import {
  createTemplateSearchIndex,
  expandAbbreviation,
  expandQuery,
  rankByRelevanceThenUsage,
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

  it('emits a unigram and bigram for each char of an unspaced CJK run', () => {
    expect(tokenize('图像放大')).toEqual([
      '图',
      '像',
      '放',
      '大',
      '图像',
      '像放',
      '放大'
    ])
  })

  it('grams katakana including the prolonged-sound mark', () => {
    expect(tokenize('データ')).toEqual(['デ', 'ー', 'タ', 'デー', 'ータ'])
  })

  it('treats Korean as a spaced script, not an unspaced CJK run', () => {
    expect(tokenize('업스케일')).toEqual(['업스케일'])
  })

  it('grams the CJK part of a word glued to latin, keeping the whole word', () => {
    expect(tokenize('flux图像')).toEqual(['图', '像', '图像', 'flux图像'])
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
    expect(termFuzziness('control')).not.toBe(false)
  })
})

describe('expandAbbreviation', () => {
  it('expands cross-modality shorthand', () => {
    expect(expandAbbreviation('t2i')).toBe('text image')
    expect(expandAbbreviation('i2v')).toBe('image video')
    expect(expandAbbreviation('txt2img')).toBe('text image')
  })

  it('expands same-modality transforms to editing', () => {
    expect(expandAbbreviation('img2img')).toBe('image edit')
    expect(expandAbbreviation('v2v')).toBe('video edit')
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

  it('does not fuzzy-match a long word onto its shorter substring', () => {
    const index = buildIndex([
      buildTemplate({ name: 'real', title: 'SeedVR2 Image Upscale' }),
      buildTemplate({
        name: 'junk',
        title: 'Anime Text to Image',
        description: 'configure CFG scale and steps'
      })
    ])
    expect(searchTemplates(index, 'upscale')).toContain('real')
    expect(searchTemplates(index, 'upscale')).not.toContain('junk')
  })

  it('matches a CJK term inside an unspaced CJK title', () => {
    const index = buildIndex([
      buildTemplate({ name: 'zh_upscale', title: '图像放大' }), // "image upscale"
      buildTemplate({ name: 'zh_video', title: '视频补帧' }) // "video interpolation"
    ])
    // 放大 = "upscale"
    expect(searchTemplates(index, '放大')).toContain('zh_upscale')
    expect(searchTemplates(index, '放大')).not.toContain('zh_video')
  })

  it('matches a single CJK character that ends an unspaced run', () => {
    const index = buildIndex([buildTemplate({ name: 'zh', title: '图像放大' })])
    // 大 is only the trailing half of the last bigram; the unigram reaches it.
    expect(searchTemplates(index, '大')).toContain('zh')
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

  it('ranks an editing template above text-to-image for "img2img"', () => {
    const index = buildIndex([
      buildTemplate({
        name: 'text_to_image',
        title: 'Qwen Text to Image',
        tags: ['Text to Image']
      }),
      buildTemplate({
        name: 'image_edit',
        title: 'Qwen Image Edit',
        tags: ['Image Edit']
      })
    ])
    expect(searchTemplates(index, 'img2img')[0]).toBe('image_edit')
  })

  it('ranks a title match above a tag match above a description-only match', () => {
    const index = buildIndex([
      buildTemplate({
        name: 'in_description',
        title: 'Something Else',
        description: 'mentions upscale in passing'
      }),
      buildTemplate({ name: 'in_tag', title: 'Something', tags: ['Upscale'] }),
      buildTemplate({ name: 'in_title', title: 'Upscale Studio' })
    ])
    expect(searchTemplates(index, 'upscale')).toEqual([
      'in_title',
      'in_tag',
      'in_description'
    ])
  })

  it('ranks an exact title above a title with extra words', () => {
    const index = buildIndex([
      buildTemplate({ name: 'with_extra', title: 'ControlNet Guidance' }),
      buildTemplate({ name: 'exact', title: 'ControlNet' })
    ])
    expect(searchTemplates(index, 'controlnet')[0]).toBe('exact')
  })
})

describe('rankByRelevanceThenUsage', () => {
  const hit = (id: string, score: number, usage: number): SearchResult =>
    ({ id, score, usage }) as unknown as SearchResult

  // Scores 0.93/0.965/1.0 with usages 100/50/1 form an intransitive cycle under
  // a pairwise relative-band compare (A>B, B>C, but A<C), which makes Array.sort
  // input-order-dependent. Bucketing must give one stable order for any input.
  it('produces a stable order for an intransitive cluster', () => {
    const a = hit('a', 0.93, 100)
    const b = hit('b', 0.965, 50)
    const c = hit('c', 1.0, 1)

    const order = (hits: SearchResult[]) =>
      rankByRelevanceThenUsage(hits).map((h) => h.id)

    const expected = order([a, b, c])
    expect(order([c, b, a])).toEqual(expected)
    expect(order([b, a, c])).toEqual(expected)
    expect(order([c, a, b])).toEqual(expected)
  })

  it('breaks ties within a band by usage but not across bands', () => {
    const strong = hit('strong', 1.0, 1)
    const nearStrong = hit('near', 0.98, 500)
    const weak = hit('weak', 0.5, 9000)

    const ids = rankByRelevanceThenUsage([weak, strong, nearStrong]).map(
      (h) => h.id
    )
    // near (higher usage, same band as strong) leads; weak stays last on score.
    expect(ids).toEqual(['near', 'strong', 'weak'])
  })
})
