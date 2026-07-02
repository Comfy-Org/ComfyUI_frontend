import { describe, expect, it, vi } from 'vitest'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import {
  getBaseThumbnailSrc,
  getEffectiveSourceModule,
  getOverlayThumbnailSrc,
  getTemplateDescription,
  getTemplateTitle,
  isAppTemplate
} from '@/platform/workflow/templates/utils/templateUtil'

vi.mock('@/scripts/api', () => ({
  api: {
    fileURL: (path: string) => `mock-file-url${path}`,
    apiURL: (path: string) => `mock-api-url${path}`
  }
}))

function makeTemplate(overrides: Partial<TemplateInfo> = {}): TemplateInfo {
  return {
    name: 'test-template',
    mediaType: 'image',
    mediaSubtype: 'jpg',
    description: 'Test template',
    ...overrides
  }
}

describe('getEffectiveSourceModule', () => {
  it('returns the template source module when set', () => {
    expect(
      getEffectiveSourceModule(makeTemplate({ sourceModule: 'custom-module' }))
    ).toBe('custom-module')
  })

  it('defaults to the frontend-provided set when unset or empty', () => {
    expect(getEffectiveSourceModule(makeTemplate())).toBe('default')
    expect(getEffectiveSourceModule(makeTemplate({ sourceModule: '' }))).toBe(
      'default'
    )
  })
})

describe('isAppTemplate', () => {
  it('detects the .app name suffix', () => {
    expect(isAppTemplate(makeTemplate({ name: 'flux.app' }))).toBe(true)
    expect(isAppTemplate(makeTemplate({ name: 'flux' }))).toBe(false)
    expect(isAppTemplate(makeTemplate({ name: 'app.flux' }))).toBe(false)
  })
})

describe('thumbnail sources', () => {
  it('appends -1/-2 index suffixes for default templates', () => {
    const template = makeTemplate()
    expect(getBaseThumbnailSrc(template)).toBe(
      'mock-file-url/templates/test-template-1.jpg'
    )
    expect(getOverlayThumbnailSrc(template)).toBe(
      'mock-file-url/templates/test-template-2.jpg'
    )
  })

  it('uses the unsuffixed API path for custom module templates', () => {
    const template = makeTemplate({ sourceModule: 'custom-module' })
    const expected =
      'mock-api-url/workflow_templates/custom-module/test-template.jpg'
    expect(getBaseThumbnailSrc(template)).toBe(expected)
    expect(getOverlayThumbnailSrc(template)).toBe(expected)
  })
})

describe('getTemplateTitle', () => {
  it('prefers the localized title for default templates', () => {
    expect(
      getTemplateTitle(
        makeTemplate({ title: 'Title', localizedTitle: 'Localized Title' }),
        'default'
      )
    ).toBe('Localized Title')
  })

  it('falls back to title then name', () => {
    expect(getTemplateTitle(makeTemplate({ title: 'Title' }), 'default')).toBe(
      'Title'
    )
    expect(getTemplateTitle(makeTemplate(), 'custom-module')).toBe(
      'test-template'
    )
  })

  it('ignores the localized title for custom module templates', () => {
    expect(
      getTemplateTitle(
        makeTemplate({ title: 'Title', localizedTitle: 'Localized Title' }),
        'custom-module'
      )
    ).toBe('Title')
  })
})

describe('getTemplateDescription', () => {
  it('prefers the localized description', () => {
    expect(
      getTemplateDescription(
        makeTemplate({ localizedDescription: 'Localized Description' })
      )
    ).toBe('Localized Description')
  })

  it('replaces dashes and underscores with spaces', () => {
    expect(
      getTemplateDescription(
        makeTemplate({ description: 'custom-template_description' })
      )
    ).toBe('custom template description')
  })
})
