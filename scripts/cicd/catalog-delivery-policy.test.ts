import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { catalogDeliveryPlan } from './catalog-delivery-policy'

const appRegistry = `export const localeDefinitions = {
  en: {}, ja: {}, zh: {}
} as const satisfies Record<string, unknown>`
const websiteRegistry = `export const LOCALES = {
  en: {}, 'zh-CN': {}, ja: {}
} as const satisfies Record<string, unknown>
const PARTIAL_LOCALE_ROUTES = { ja: new Set(['/']) }`
const input = {
  branch: 'feature/copy',
  sameRepository: true,
  changed: [],
  added: [],
  versionChanged: false,
  appRegistry,
  previousAppRegistry: appRegistry,
  websiteRegistry,
  previousWebsiteRegistry: websiteRegistry
}

describe('catalog delivery scopes', () => {
  it.for([
    {
      name: 'ordinary English copy uses fallback',
      update: {
        changed: [
          'src/locales/en/main.json',
          'apps/website/src/locales/en/main.json'
        ]
      },
      expected: { app: null, website: null }
    },
    {
      name: 'release branches require shipped app locales',
      update: { branch: 'version-bump-1.58.0' },
      expected: { app: ['ja', 'zh'], website: null }
    },
    {
      name: 'fork branch names cannot claim generation',
      update: { branch: 'version-bump-1.58.0', sameRepository: false },
      expected: { app: null, website: null }
    },
    {
      name: 'version changes require shipped locales without branch metadata',
      update: { versionChanged: true, branch: '' },
      expected: { app: ['ja', 'zh'], website: null }
    },
    {
      name: 'generated app manifests require all configured outputs',
      update: { changed: ['src/locales/.source-manifest.json'] },
      expected: { app: 'all', website: null }
    },
    {
      name: 'node generation branches require all configured outputs',
      update: { branch: 'update-locales-node-defs-manual-42' },
      expected: { app: 'all', website: null }
    },
    {
      name: 'website manifests require every website output',
      update: { changed: ['apps/website/src/locales/.source-manifest.json'] },
      expected: { app: null, website: ['zh-CN', 'ja'] }
    },
    {
      name: 'website bot branches require every website output',
      update: { branch: 'bl/website-locale-updates' },
      expected: { app: null, website: ['zh-CN', 'ja'] }
    },
    {
      name: 'simultaneous deliveries retain both scopes',
      update: {
        versionChanged: true,
        changed: ['apps/website/src/locales/.source-manifest.json']
      },
      expected: { app: ['ja', 'zh'], website: ['zh-CN', 'ja'] }
    }
  ])('$name', ({ update, expected }) => {
    expect(catalogDeliveryPlan({ ...input, ...update })).toEqual(expected)
  })

  it.for([
    {
      name: 'new shipped app locale',
      update: {
        appRegistry:
          'export const localeDefinitions = { en: {}, ja: {}, zh: {}, de: {} }'
      },
      expected: { app: ['de'], website: null }
    },
    {
      name: 'new website locale',
      update: {
        previousWebsiteRegistry:
          "export const LOCALES = { en: {}, 'zh-CN': {} }; const PARTIAL_LOCALE_ROUTES = {}"
      },
      expected: { app: null, website: ['ja'] }
    },
    {
      name: 'expanded Japanese publication scope',
      update: {
        websiteRegistry: websiteRegistry.replace(
          "new Set(['/'])",
          "new Set(['/', '/cloud/'])"
        )
      },
      expected: { app: null, website: ['ja'] }
    },
    {
      name: 'Japanese full-site launch',
      update: {
        websiteRegistry: websiteRegistry.replace("ja: new Set(['/'])", '')
      },
      expected: { app: null, website: ['ja'] }
    },
    {
      name: 'new localized route',
      update: { added: ['apps/website/src/pages/ja/cloud.astro'] },
      expected: { app: null, website: ['ja'] }
    },
    {
      name: 'English-only route permits fallback',
      update: { added: ['apps/website/src/pages/cloud.astro'] },
      expected: { app: null, website: null }
    },
    {
      name: 'existing localized copy permits fallback',
      update: { changed: ['apps/website/src/pages/zh-CN/cloud.astro'] },
      expected: { app: null, website: null }
    },
    {
      name: 'trailing slash normalization is not a launch',
      update: {
        previousWebsiteRegistry: websiteRegistry.replace(
          "new Set(['/'])",
          "new Set(['/', '/cloud/'])"
        ),
        websiteRegistry: websiteRegistry.replace(
          "new Set(['/'])",
          "new Set(['/', '/cloud'])"
        )
      },
      expected: { app: null, website: null }
    }
  ])('requires complete coverage for $name', ({ update, expected }) => {
    expect(catalogDeliveryPlan({ ...input, ...update })).toEqual(expected)
  })

  it('derives release scope from the actual shipped registry', () => {
    const source = readFileSync('src/locales/localeConfig.ts', 'utf8')
    const plan = catalogDeliveryPlan({
      ...input,
      versionChanged: true,
      appRegistry: source,
      previousAppRegistry: source
    })
    expect(plan.app).toEqual([
      'zh',
      'zh-TW',
      'ru',
      'ja',
      'ko',
      'fr',
      'es',
      'ar',
      'tr',
      'pt-BR',
      'fa',
      'he',
      'it'
    ])
  })

  it.for([
    { appRegistry: 'export const localeDefinitions = dynamicLocales()' },
    { appRegistry: 'export const localeDefinitions = { ...other }' },
    { websiteRegistry: 'export const LOCALES = {}' },
    {
      websiteRegistry: websiteRegistry.replace("new Set(['/'])", 'getRoutes()')
    }
  ])('fails visibly on unsupported publication metadata', (update) => {
    expect(() => catalogDeliveryPlan({ ...input, ...update })).toThrow()
  })
})
