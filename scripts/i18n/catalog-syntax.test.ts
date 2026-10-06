import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'

import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import config from '../../eslint.config'
import { getLeaf, readLocale } from './locale-tree'

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: config
})

function readMessage(filename: string, path: string[]): string {
  const value = getLeaf(readLocale(filename), path)
  if (typeof value !== 'string') {
    throw new Error(`${filename}: ${path.join('.')} is not a message`)
  }
  return value
}

describe('catalog syntax lint', () => {
  let packageCatalog: string

  beforeAll(() => {
    const directory = mkdtempSync(join(process.cwd(), 'packages/catalog-lint-'))
    const localeDirectory = join(directory, 'src/locales/en')
    mkdirSync(localeDirectory, { recursive: true })
    packageCatalog = join(localeDirectory, 'auth.json')
    writeFileSync(packageCatalog, JSON.stringify({ message: '' }))
    return () => rmSync(directory, { recursive: true, force: true })
  })

  it.for([
    'src/locales/en/main.json',
    'src/locales/ja/commands.json',
    'src/locales/zh/settings.json',
    'apps/website/src/locales/zh-CN/main.json',
    'apps/billing-web/src/locales/en/main.json'
  ])('rejects invalid messages in %s', async (filePath) => {
    const results = await eslint.lintText(
      JSON.stringify({ message: 'Contact support@comfy.org' }),
      { filePath }
    )

    expect(results.flatMap((result) => result.messages)).toContainEqual(
      expect.objectContaining({
        ruleId: '@intlify/vue-i18n/valid-message-syntax',
        severity: 2
      })
    )
  })

  it.for(['Hello {name', 'Hello {name!}', '@:'])(
    'rejects malformed syntax: %s',
    async (message) => {
      const results = await eslint.lintText(
        JSON.stringify({ nested: { messages: [message] } }),
        { filePath: 'src/locales/en/main.json' }
      )

      expect(results.flatMap((result) => result.messages)).toContainEqual(
        expect.objectContaining({
          ruleId: '@intlify/vue-i18n/valid-message-syntax',
          severity: 2
        })
      )
    }
  )

  it('accepts stable message syntax and intentional empty strings', async () => {
    const results = await eslint.lintText(
      JSON.stringify({
        email: "support{'@'}comfy.org",
        literals: "{'|'} {'{'}name{'}'}",
        named: 'Hello {name}',
        list: 'Hello {0}',
        linked: '@:named',
        plural: 'No items | One item | {count} items',
        reordered: '{amount} for {plan}',
        empty: ''
      }),
      { filePath: 'apps/website/src/locales/ja/main.json' }
    )

    expect(results.flatMap((result) => result.messages)).toEqual([])
  })

  it('discovers catalogs added by a shared package', async () => {
    const results = await eslint.lintText(
      JSON.stringify({ message: 'Contact support@comfy.org' }),
      { filePath: packageCatalog }
    )

    expect(results.flatMap((result) => result.messages)).toContainEqual(
      expect.objectContaining({
        ruleId: '@intlify/vue-i18n/valid-message-syntax',
        severity: 2
      })
    )
  })
})

describe('catalog literal rendering', () => {
  it.for(
    readdirSync('src/locales', { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
  )('renders the support email in %s', (locale) => {
    const message = readMessage(`src/locales/${locale}/main.json`, [
      'auth',
      'errors',
      'signupBlocked'
    ])
    const i18n = createI18n({
      legacy: false,
      locale,
      messages: { [locale]: { signupBlocked: message } }
    })

    expect(i18n.global.t('signupBlocked')).toContain('support@comfy.org')
  })

  it('renders the profile placeholder as a literal at sign', () => {
    const message = readMessage('src/locales/en/main.json', [
      'comfyHubProfile',
      'usernamePlaceholder'
    ])
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { usernamePlaceholder: message } }
    })

    expect(i18n.global.t('usernamePlaceholder')).toBe('@')
  })

  it('renders the billing support email', () => {
    const message = readMessage('apps/billing-web/src/locales/en/main.json', [
      'auth',
      'errors',
      'signupBlocked'
    ])
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { signupBlocked: message } }
    })

    expect(i18n.global.t('signupBlocked')).toContain('support@comfy.org')
  })
})
