import { describe, expect, it } from 'vitest'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import {
  filterTemplatesByType,
  getProviderBadges,
  getProviderIconClass,
  getTemplateTags,
  isAppTemplate
} from '@/platform/workflow/templates/utils/templateDisplay'

function template(overrides: Partial<TemplateInfo> = {}): TemplateInfo {
  return {
    name: 'demo',
    description: '',
    mediaType: 'image',
    mediaSubtype: 'webp',
    ...overrides
  }
}

describe('getProviderIconClass', () => {
  it('resolves a provider whose name matches its icon file', () => {
    expect(getProviderIconClass('openai')).toBe('icon-mask-[comfy--openai]')
  })

  it('normalizes case and surrounding whitespace', () => {
    expect(getProviderIconClass('  ByteDance ')).toBe(
      'icon-mask-[comfy--bytedance]'
    )
  })

  it('maps aliases whose display name differs from the icon slug', () => {
    expect(getProviderIconClass('Google')).toBe('icon-mask-[comfy--gemini]')
    expect(getProviderIconClass('Black Forest Labs')).toBe(
      'icon-mask-[comfy--bfl]'
    )
    expect(getProviderIconClass('Lightricks')).toBe('icon-mask-[comfy--ltxv]')
  })

  it('hyphenates multi-word names so they match hyphenated icon files', () => {
    expect(getProviderIconClass('Stability AI')).toBe(
      'icon-mask-[comfy--stability-ai]'
    )
  })

  it('returns null when no icon exists for the provider', () => {
    expect(getProviderIconClass('acme')).toBeNull()
  })

  it('returns null rather than a malformed class for junk input', () => {
    expect(getProviderIconClass('   ')).toBeNull()
    expect(getProviderIconClass('!!!')).toBeNull()
  })
})

describe('getProviderBadges', () => {
  const withLogos = (provider: string) => `/logos/${provider}.png`
  const noLogos = () => ''

  it('flattens stacked provider entries', () => {
    const badges = getProviderBadges({ provider: ['kling', 'luma'] }, withLogos)

    expect(badges?.visible.map((badge) => badge.provider)).toEqual([
      'kling',
      'luma'
    ])
  })

  it('keeps a provider without a comfy icon so its raster logo can render', () => {
    const badges = getProviderBadges({ provider: 'acme' }, withLogos)

    expect(badges?.visible).toEqual([
      { provider: 'acme', iconClass: null, logoUrl: '/logos/acme.png' }
    ])
  })

  it('keeps a provider with a comfy icon but no logo url', () => {
    const badges = getProviderBadges({ provider: 'Google' }, noLogos)

    expect(badges?.visible).toEqual([
      {
        provider: 'Google',
        iconClass: 'icon-mask-[comfy--gemini]',
        logoUrl: ''
      }
    ])
  })

  it('drops a provider that has neither an icon nor a logo url', () => {
    const badges = getProviderBadges({ provider: ['openai', 'acme'] }, (p) =>
      p === 'openai' ? '/logos/openai.png' : ''
    )

    expect(badges?.visible.map((badge) => badge.provider)).toEqual(['openai'])
  })

  it('returns null when no provider resolves to an icon or a logo', () => {
    expect(getProviderBadges({ provider: 'acme' }, noLogos)).toBeNull()
  })

  it('collapses providers beyond the visible limit into extraProviders', () => {
    const badges = getProviderBadges(
      {
        provider: ['openai', 'kling', 'luma', 'runway', 'veo', 'vidu', 'topaz']
      },
      withLogos
    )

    expect(badges?.visible.map((badge) => badge.provider)).toEqual([
      'openai',
      'kling',
      'luma',
      'runway',
      'veo'
    ])
    expect(badges?.extraProviders).toEqual(['vidu', 'topaz'])
  })

  it('leaves extraProviders empty at exactly the visible limit', () => {
    const badges = getProviderBadges(
      { provider: ['openai', 'kling', 'luma', 'runway', 'veo'] },
      withLogos
    )

    expect(badges?.extraProviders).toEqual([])
  })
})

describe('isAppTemplate', () => {
  it('reads the isApp flag rather than the filename', () => {
    expect(isAppTemplate(template({ name: 'anything', isApp: true }))).toBe(
      true
    )
    expect(isAppTemplate(template({ name: 'anything' }))).toBe(false)
  })

  // The suffix records how a workflow was saved, not what it is, so it was wrong
  // in both directions against templates/index.json.
  it('does not treat a .app filename as an App on its own', () => {
    expect(
      isAppTemplate(
        template({ name: 'templates_all_in_one_image_edit_models.app' })
      )
    ).toBe(false)
  })

  it('recognises an App whose name has no .app suffix', () => {
    expect(
      isAppTemplate(
        template({ name: 'template_qwen_image_illustration_lora', isApp: true })
      )
    ).toBe(true)
  })

  it('treats an explicit false as a node graph', () => {
    expect(isAppTemplate(template({ name: 'thing.app', isApp: false }))).toBe(
      false
    )
  })
})

describe('filterTemplatesByType', () => {
  const templates = [
    template({ name: 'graph-one' }),
    template({ name: 'thing.app', isApp: true }),
    template({ name: 'graph-two' })
  ]

  it('returns every template when no type is selected', () => {
    expect(filterTemplatesByType(templates, 'all')).toEqual(templates)
  })

  it('keeps only app templates for the apps tab', () => {
    expect(filterTemplatesByType(templates, 'apps').map((t) => t.name)).toEqual(
      ['thing.app']
    )
  })

  it('excludes app templates from the node graph tab', () => {
    expect(
      filterTemplatesByType(templates, 'nodeGraph').map((t) => t.name)
    ).toEqual(['graph-one', 'graph-two'])
  })

  it('handles an empty template list', () => {
    expect(filterTemplatesByType([], 'apps')).toEqual([])
  })
})

describe('getTemplateTags', () => {
  it('returns empty lists when the template has no tags', () => {
    expect(getTemplateTags(template())).toEqual({ visible: [], hidden: [] })
  })

  it('shows every tag when they fit within the visible limit', () => {
    expect(getTemplateTags(template({ tags: ['a', 'b'] }))).toEqual({
      visible: ['a', 'b'],
      hidden: []
    })
  })

  it('hides only the tags beyond the visible limit', () => {
    expect(getTemplateTags(template({ tags: ['a', 'b', 'c', 'd'] }))).toEqual({
      visible: ['a', 'b'],
      hidden: ['c', 'd']
    })
  })
})
