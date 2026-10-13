import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { translationTargets } from './config'
import { pathKey, readLocale } from './locale-tree'
import {
  auditLocaleTokens,
  leafTokensDiffer,
  tokenErrors
} from './protected-tokens'

const sourceLink = '[FAQ](https://comfy.org/pricing/?q=1#faq)'
const localizedLink = '[问答](https://comfy.org/zh-CN/pricing/?q=1#faq)'
const nowrapTitle = 'Use <span class="whitespace-nowrap">{name}</span>'
const titleGroups = [[['before'], ['after']]]
const repoRoot = resolve(import.meta.dirname, '../..')
const websiteSource = readLocale(
  resolve(repoRoot, 'apps/website/src/locales/en/main.json')
)
const websiteCatalogs = translationTargets.website.outputLocales.map(
  ({ code }) => ({
    code,
    catalog: readLocale(
      resolve(repoRoot, `apps/website/src/locales/${code}/main.json`)
    )
  })
)

describe('authored website token contracts', () => {
  it.for([
    { source: sourceLink, target: localizedLink },
    {
      source: '<a href="https://comfy.org/pricing/?q=1#faq">FAQ</a>',
      target: '<a href="https://comfy.org/zh-CN/pricing/?q=1#faq">问答</a>'
    },
    { source: nowrapTitle, target: '使用 {name}' },
    {
      source: '<span class="whitespace-nowrap"><strong>{name}</strong></span>',
      target: '<strong>{name}</strong>'
    },
    {
      source:
        '<span class="whitespace-nowrap"><span class="brand">{name}</span></span>',
      target: '<span class="brand">{name}</span>'
    }
  ])(
    'accepts localized links and presentational wrappers',
    ({ source, target }) => {
      expect(
        leafTokensDiffer(source, target, { strict: true, localeCode: 'zh-CN' })
      ).toBe(false)
      expect(
        tokenErrors(source, target, { strict: true }).length
      ).toBeGreaterThan(0)
    }
  )

  it.for([
    '[问答](https://other.org/zh-CN/pricing/?q=1#faq)',
    '[问答](http://comfy.org/zh-CN/pricing/?q=1#faq)',
    '[问答](https://comfy.org/zh-CN/enterprise/?q=1#faq)',
    '[问答](https://comfy.org/ja/pricing/?q=1#faq)',
    '[问答](https://comfy.org/zh-CN/pricing/?q=2#faq)',
    '[问答](https://comfy.org/zh-CN/pricing/?q=1#other)',
    '[问答](https://comfy.org/zh-CN/zh-CN/pricing/?q=1#faq)',
    '[问答](https://comfy.org/zh-CN//pricing/?q=1#faq)'
  ])('rejects an altered localized destination: %s', (target) => {
    expect(
      leafTokensDiffer(sourceLink, target, {
        strict: true,
        localeCode: 'zh-CN'
      })
    ).toBe(true)
  })

  it.for([
    { source: '<span class="brand">{name}</span>', target: '{name}' },
    {
      source: '<span class="whitespace-nowrap brand">{name}</span>',
      target: '{name}'
    },
    {
      source: '<span class="whitespace-nowrap" title="brand">{name}</span>',
      target: '{name}'
    },
    { source: nowrapTitle, target: '使用名字' },
    { source: nowrapTitle, target: '<span class="whitespace-nowrap">{name}' }
  ])(
    'keeps semantic markup and placeholder requirements',
    ({ source, target }) => {
      expect(
        leafTokensDiffer(source, target, { strict: true, localeCode: 'zh-CN' })
      ).toBe(true)
    }
  )

  it('keeps pricing units required', () => {
    const source = 'Typical cost: {credits} credits per {unit}.'
    expect(
      tokenErrors(source, '默认设置下约 {credits} 积分。', { strict: true })
    ).toEqual(['missing {unit}'])
    expect(
      tokenErrors(source, '默认设置下每 {unit} 约 {credits} 积分。', {
        strict: true
      })
    ).toEqual([])
  })

  it.for(websiteCatalogs)(
    '$code preserves every catalog token contract',
    ({ code, catalog }) => {
      expect(
        auditLocaleTokens(websiteSource, catalog, new Set(), {
          strict: true,
          localeCode: code,
          groups: translationTargets.website.messageGroups
        })
      ).toEqual([])
    }
  )
})

describe('tokens shared across message fragments', () => {
  it('ignores a configured group absent from this entry file', () => {
    expect(
      auditLocaleTokens(
        { text: 'Hello {name}' },
        { text: '你好 {name}' },
        new Set(),
        { strict: true, groups: titleGroups }
      )
    ).toEqual([])
  })

  it('allows a placeholder to move into an intentionally empty fragment', () => {
    expect(
      auditLocaleTokens(
        { before: '{name} in ', after: '' },
        { before: '', after: ' 中的 {name}' },
        new Set([pathKey(['before'])]),
        { strict: true, groups: titleGroups }
      )
    ).toEqual([])
  })

  it.for([
    {
      before: '',
      after: ' 中的名称',
      expected: [{ path: ['before'], code: 'missing-token', token: '{name}' }]
    },
    {
      before: '',
      after: ' 中的 {name} {extra}',
      expected: [{ path: ['before'], code: 'added-token', token: '{extra}' }]
    },
    {
      before: '',
      after: ' 中的 {name} {name}',
      expected: [{ path: ['before'], code: 'added-token', token: '{name}' }]
    },
    {
      before: '',
      after: '',
      expected: [
        { path: ['before'], code: 'missing-token', token: '{name}' },
        { path: ['before'], code: 'empty-translation', token: '' }
      ]
    }
  ])('rejects changed group tokens', ({ before, after, expected }) => {
    expect(
      auditLocaleTokens(
        { before: '{name} in ', after: '' },
        { before, after },
        new Set([pathKey(['before'])]),
        { strict: true, groups: titleGroups }
      )
    ).toEqual(expected)
  })

  it('rejects a missing member instead of treating it as intentional emptiness', () => {
    expect(
      auditLocaleTokens(
        { before: '{name} in ', after: '' },
        { after: '{name}' },
        new Set(),
        { strict: true, groups: titleGroups }
      )
    ).toEqual([{ path: ['before'], code: 'leaf-type-changed', token: '' }])
  })
})

describe('Intlify named placeholders and linked messages', () => {
  it('renders and preserves underscore and dollar names', () => {
    const { t } = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { message: 'Hello {_name}: {total$}' } }
    }).global
    expect(t('message', { _name: 'Ben', total$: 4 })).toBe('Hello Ben: 4')
    expect(
      tokenErrors('Hello {_name}: {total$}', '你好 {_name}: {total$}')
    ).toEqual([])
    expect(
      tokenErrors('Hello {_name}: {total$}', '你好 {name}: {total}')
    ).toEqual(['missing {_name}, {total$}', 'added {name}, {total}'])
  })

  it.for([
    {
      linked: '@:g.cancel',
      missing: 'missing @:g.cancel',
      changed: ['missing @:g.cancel', 'added @:g.save']
    },
    {
      linked: '@.lower:g.cancel',
      missing: 'missing @.lower:g.cancel',
      changed: ['missing @.lower:g.cancel', 'added @.lower:g.save']
    },
    {
      linked: "@:{'g.cancel'}",
      missing: "missing @:{'g.cancel'}, {'g.cancel'}",
      changed: [
        "missing @:{'g.cancel'}, {'g.cancel'}",
        "added @:{'g.save'}, {'g.save'}"
      ]
    }
  ])(
    'preserves an existing linked message $linked',
    ({ linked, missing, changed }) => {
      expect(tokenErrors(`Use ${linked}`, `使用 ${linked}`)).toEqual([])
      expect(tokenErrors(`Use ${linked}`, '使用')).toEqual([missing])
      expect(
        tokenErrors(`Use ${linked}`, linked.replace('cancel', 'save'))
      ).toEqual(changed)
    }
  )

  it('keeps literal interpolation opaque to linked-message detection', () => {
    expect(tokenErrors("Use {'@:g.cancel'}", "使用 {'@:g.cancel'}")).toEqual([])
    expect(tokenErrors("Use {'@'}", "使用 {'@'}")).toEqual([])
  })

  it('rejects changing the modifier of an existing linked message', () => {
    expect(
      tokenErrors('Use @.lower:g.cancel', '使用 @.upper:g.cancel')
    ).toEqual(['missing @.lower:g.cancel', 'added @.upper:g.cancel'])
  })
})
