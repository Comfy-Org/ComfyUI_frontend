import { describe, expect, it } from 'vitest'

import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { cliCtas } from './ctas'

const locales: Locale[] = ['en', 'zh-CN']

describe('cliCtas', () => {
  it.each(locales)('resolves labels and links for %s', (locale) => {
    const { docs, installCli } = cliCtas(locale)

    expect(docs.label).not.toBe('')
    expect(docs.href).toBe(externalLinks.docsCli)
    expect(docs.target).toBe('_blank')

    expect(installCli.label).not.toBe('')
    expect(installCli.href).toBe('#setup')
  })
})
