import { describe, expect, it } from 'vitest'

import { pathKey } from './locale-tree'
import type { TokenViolation } from './protected-tokens'
import {
  auditLocaleTokens,
  formatTokenViolation,
  leafTokensDiffer,
  protectedTokens,
  tokenErrors
} from './protected-tokens'

function audit(
  source: string,
  target: string,
  options: { strict: boolean; localeCode?: string }
): Omit<TokenViolation, 'path'>[] {
  return auditLocaleTokens(
    { text: source },
    { text: target },
    new Set(),
    options
  ).map(({ code, token }) => ({ code, token }))
}

const faqLink = '<a href="/pricing/#faq" class="underline">FAQ</a>'
const faqOpenTag = '<a href="/pricing/#faq" class="underline">'
const localizedFaqLink =
  '<a href="/zh-CN/pricing/#faq" class="underline">常见问题</a>'

describe('strict protected-token audit', () => {
  it.for([
    {
      name: 'a plural collapsed to one form',
      source: '{count} node | {count} nodes',
      target: '{count} 个节点'
    },
    {
      name: 'every plural form kept with the zero form lacking a placeholder',
      source: 'No items | {count} item | {count} items',
      target: '没有项目 | {count} 个项目 | {count} 个项目'
    },
    {
      name: 'balanced spans reordered',
      source:
        'Run <strong>models</strong> via <a href="https://x.org" class="u">nodes</a>',
      target:
        '通过<a href="https://x.org" class="u">节点</a>运行<strong>模型</strong>'
    },
    {
      name: 'reordered attributes',
      source: '<a class="u" href="https://x.org">x</a>',
      target: '<a href="https://x.org" class="u">x</a>'
    },
    {
      name: 'a void element',
      source: 'One<br>Two',
      target: '一<br>二'
    },
    {
      name: 'an uppercase tag written in lowercase',
      source: 'Use <B>bold</B>',
      target: '使用<b>粗体</b>'
    },
    {
      name: 'less-than prose next to markup',
      source: 'If x<y then <b>stop</b>',
      target: '若 x<y 则<b>停止</b>'
    },
    {
      name: "a literal {'|'}",
      source: "Events {'|'} Comfy",
      target: "活动 {'|'} Comfy"
    },
    {
      name: 'an internal link with the exact locale prefix',
      source: faqLink,
      target: localizedFaqLink,
      localeCode: 'zh-CN'
    }
  ])('accepts $name', ({ source, target, localeCode }) => {
    expect(audit(source, target, { strict: true, localeCode })).toEqual([])
  })

  it.for([
    {
      name: 'one omitted occurrence of a repeated literal',
      source: "Ask {'@'}support or {'@'}sales",
      target: "Ask {'@'}support",
      expected: [{ code: 'missing-token', token: "{'@'}" }]
    },
    {
      name: 'every omitted occurrence of a repeated span',
      source: '<em>a</em> and <em>b</em>',
      target: 'a and b',
      expected: [
        { code: 'missing-token', token: '</em>' },
        { code: 'missing-token', token: '</em>' },
        { code: 'missing-token', token: '<em>' },
        { code: 'missing-token', token: '<em>' }
      ]
    },
    {
      name: 'a dropped uppercase span',
      source: 'Use <B>bold</B>',
      target: 'Use bold',
      expected: [
        { code: 'missing-token', token: '</B>' },
        { code: 'missing-token', token: '<B>' }
      ]
    },
    {
      name: 'a partial plural collapse',
      source: 'No items | {count} item | {count} items',
      target: '没有项目 | {count} 个项目',
      expected: [{ code: 'plural-form-count-changed', token: '|' }]
    },
    {
      name: 'a placeholder dropped from one kept plural form',
      source: '{count} item | {count} items',
      target: '{count} 项 | 项',
      expected: [{ code: 'missing-token', token: '{count}' }]
    },
    {
      name: 'markup dropped from one kept plural form',
      source: '<b>{n}</b> item | <b>{n}</b> items',
      target: '<b>{n}</b> 项 | {n} 项',
      expected: [
        { code: 'missing-token', token: '</b>' },
        { code: 'missing-token', token: '<b>' }
      ]
    },
    {
      name: 'a placeholder renamed in a collapsed plural',
      source: 'No items | {count} item | {count} items',
      target: '{total} 个项目',
      expected: [
        { code: 'missing-token', token: '{count}' },
        { code: 'added-token', token: '{total}' }
      ]
    },
    {
      name: "repeated tokens on both sides of a literal {'|'}",
      source: "{a} {'|'} {a}",
      target: "{a} {'|'}",
      expected: [{ code: 'missing-token', token: '{a}' }]
    },
    {
      name: "a literal {'|'} turned into a plural separator",
      source: "Events {'|'} Comfy",
      target: '活动 | Comfy',
      expected: [
        { code: 'missing-token', token: "{'|'}" },
        { code: 'added-plural-separator', token: '|' }
      ]
    },
    {
      name: 'crossed nesting',
      source: '<strong><em>x</em></strong>',
      target: '<strong><em>x</strong></em>',
      expected: [{ code: 'malformed-markup', token: '</strong>' }]
    },
    {
      name: 'an unclosed span',
      source: '<strong>x</strong> y',
      target: '<strong>x y',
      expected: [
        { code: 'missing-token', token: '</strong>' },
        { code: 'malformed-markup', token: '<strong>' }
      ]
    },
    {
      name: 'a changed attribute value',
      source: '<a href="mailto:support@comfy.org">mail</a>',
      target: '<a href="mailto:help@comfy.org">mail</a>',
      expected: [
        { code: 'missing-token', token: '<a href="mailto:support@comfy.org">' },
        { code: 'added-token', token: '<a href="mailto:help@comfy.org">' }
      ]
    }
  ])('reports $name', ({ source, target, expected }) => {
    expect(audit(source, target, { strict: true })).toEqual(expected)
  })

  it.for([
    {
      name: 'another locale prefix',
      source: faqLink,
      target: '<a href="/ja/pricing/#faq" class="underline">FAQ</a>',
      localeCode: 'zh-CN',
      missing: faqOpenTag,
      added: '<a href="/ja/pricing/#faq" class="underline">'
    },
    {
      name: 'a different localized link',
      source: faqLink,
      target: '<a href="/zh-CN/enterprise/" class="underline">FAQ</a>',
      localeCode: 'zh-CN',
      missing: faqOpenTag,
      added: '<a href="/zh-CN/enterprise/" class="underline">'
    },
    {
      name: 'a doubled locale prefix',
      source: faqLink,
      target: '<a href="/zh-CN/zh-CN/pricing/#faq" class="underline">FAQ</a>',
      localeCode: 'zh-CN',
      missing: faqOpenTag,
      added: '<a href="/zh-CN/zh-CN/pricing/#faq" class="underline">'
    },
    {
      name: 'a locale prefix without a named locale',
      source: faqLink,
      target: localizedFaqLink,
      localeCode: undefined,
      missing: faqOpenTag,
      added: '<a href="/zh-CN/pricing/#faq" class="underline">'
    },
    {
      name: 'a locale segment in an absolute URL',
      source: '<a href="https://comfy.org/">x</a>',
      target: '<a href="https://comfy.org/zh-CN/">x</a>',
      localeCode: 'zh-CN',
      missing: '<a href="https://comfy.org/">',
      added: '<a href="https://comfy.org/zh-CN/">'
    }
  ])('rejects $name', ({ source, target, localeCode, missing, added }) => {
    expect(audit(source, target, { strict: true, localeCode })).toEqual([
      { code: 'missing-token', token: missing },
      { code: 'added-token', token: added }
    ])
  })
})

describe('non-strict protected-token audit', () => {
  it.for([
    {
      name: 'ignores repeated tokens and markup',
      source: '<b>{n}</b> and {n}',
      target: '{n}',
      expected: []
    },
    {
      name: 'compares placeholders as a set across plural forms',
      source: 'No items | {count} item | {count} items',
      target: '没有项目 | {count} 个项目',
      expected: []
    },
    {
      name: "reports a literal {'|'} turned into a plural separator",
      source: "Events {'|'} Comfy",
      target: 'Events | Comfy',
      expected: [
        { code: 'missing-token', token: "{'|'}" },
        { code: 'added-plural-separator', token: '|' }
      ]
    }
  ])('$name', ({ source, target, expected }) => {
    expect(audit(source, target, { strict: false })).toEqual(expected)
  })

  it.for(["{'|'}", "{'@.'}"])(
    'reports added literal %s without misclassifying it as message syntax',
    (literal) => {
      expect(audit('Text', `Text ${literal}`, { strict: false })).toEqual([
        { code: 'added-token', token: literal }
      ])
    }
  )
})

describe('auditLocaleTokens', () => {
  it('reports array elements, array shape, leaf types, and non-string values', () => {
    expect(
      auditLocaleTokens(
        {
          list: ['Use {name}', 'Second'],
          shape: ['a', 'b'],
          type: ['a'],
          flag: true,
          skipped: 'Hi {name}'
        },
        {
          list: ['Use nom', 'Deuxième'],
          shape: ['a'],
          type: 'a',
          flag: false,
          skipped: 'Salut'
        },
        new Set([pathKey(['skipped'])])
      )
    ).toEqual([
      { path: ['list', '0'], code: 'missing-token', token: '{name}' },
      { path: ['shape'], code: 'array-length-changed', token: '' },
      { path: ['type'], code: 'leaf-type-changed', token: '' },
      { path: ['flag'], code: 'leaf-value-changed', token: '' }
    ])
  })

  it('keeps path identity structural even when rendered paths coincide', () => {
    const violations = auditLocaleTokens(
      { 'a.b': 'Hi {name}', a: { b: 'Hi {name}' } },
      { 'a.b': 'Salut', a: { b: 'Salut' } },
      new Set()
    )
    expect(violations).toEqual([
      { path: ['a.b'], code: 'missing-token', token: '{name}' },
      { path: ['a', 'b'], code: 'missing-token', token: '{name}' }
    ])
    expect(violations.map(formatTokenViolation)).toEqual([
      'a.b: missing {name}',
      'a.b: missing {name}'
    ])
  })
})

describe('tokenErrors', () => {
  it('groups missing tokens and never accepts a localized source URL', () => {
    expect(
      tokenErrors("Ask {'@'}support or {'@'}sales {name}", 'Demandez support', {
        strict: true
      })
    ).toEqual(["missing {'@'}, {'@'}, {name}"])
    expect(tokenErrors(faqLink, localizedFaqLink, { strict: true })).toEqual([
      `missing ${faqOpenTag}`,
      'added <a href="/zh-CN/pricing/#faq" class="underline">'
    ])
  })
})

describe('leafTokensDiffer', () => {
  it('accepts an authored localized link only for the named locale', () => {
    expect(
      leafTokensDiffer(faqLink, localizedFaqLink, {
        strict: true,
        localeCode: 'zh-CN'
      })
    ).toBe(false)
    expect(
      leafTokensDiffer(faqLink, localizedFaqLink, {
        strict: true,
        localeCode: 'ja'
      })
    ).toBe(true)
  })
})

describe('protectedTokens', () => {
  it('lists the per-form token multiset without inventing localized routes', () => {
    expect(
      protectedTokens(
        '<a href="/enterprise/">{count} seat</a> | <a href="https://x.org">{count} seats</a>',
        { strict: true }
      )
    ).toEqual([
      '</a>',
      '<a href="/enterprise/">',
      '<a href="https://x.org">',
      '{count}'
    ])
  })

  it('lists uppercase tags and media placeholders once, not less-than prose', () => {
    expect(
      protectedTokens('If x<y, show <Video abc> in <B>bold</B>', {
        strict: true
      })
    ).toEqual(['</B>', '<B>', '<Video abc>'])
  })
})
