import { describe, expect, it } from 'vitest'

import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { cloudNodesCtas } from './ctas'

const locales: Locale[] = ['en', 'zh-CN']

describe('cloudNodesCtas', () => {
  it.for(locales)('resolves labels and links for %s', (locale) => {
    const { getStarted, docs, update } = cloudNodesCtas(locale)

    expect(getStarted.label).not.toBe('')
    expect(getStarted.href).toBe(externalLinks.cloud)
    expect(getStarted.target).toBe('_blank')

    expect(docs.label).not.toBe('')
    expect(docs.href).toBe(externalLinks.docsCloudNodes)
    expect(docs.target).toBe('_blank')

    expect(update.label).not.toBe('')
    expect(update.href).toBe(externalLinks.docsUpdateComfyUI)
    expect(update.target).toBe('_blank')
  })

  it('points updating at the canonical docs page', () => {
    expect(externalLinks.docsUpdateComfyUI).toBe(
      'https://docs.comfy.org/installation/update_comfyui'
    )
  })
})
