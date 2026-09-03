import { describe, expect, it } from 'vitest'

import { protectedTokens, tokenErrors } from './protected-tokens'

describe('protectedTokens', () => {
  it('extracts HTML tags by name and interpolation placeholders', () => {
    expect(
      protectedTokens('Save <strong>{count}</strong> credits with {plan}')
    ).toEqual(['</strong>', '<strong>', '{count}', '{plan}'])
  })

  it('ignores tag attributes when identifying a tag', () => {
    expect(protectedTokens('<a href="/docs">docs</a>')).toEqual(['</a>', '<a>'])
  })

  it('deduplicates repeated tokens', () => {
    expect(protectedTokens('{name} and {name}')).toEqual(['{name}'])
  })

  it('returns nothing for plain text', () => {
    expect(protectedTokens('Run your first workflow')).toEqual([])
  })
})

describe('tokenErrors', () => {
  it('passes when every protected token survives', () => {
    expect(
      tokenErrors(
        'Save <strong>{count}</strong> credits',
        '{count} 個のクレジットを<strong>節約</strong>'
      )
    ).toEqual([])
  })

  it('allows an href to be localized to a locale-prefixed path', () => {
    expect(
      tokenErrors(
        'Read <a href="/cloud/pricing#faq">the FAQ</a>',
        '<a href="/zh-CN/cloud/pricing#faq">常见问题</a>を読む'
      )
    ).toEqual([])
  })

  it('flags a dropped tag', () => {
    expect(
      tokenErrors('Read <a href="/docs">the docs</a>', 'ドキュメントを読む')
    ).toEqual(['missing </a>, <a>'])
  })

  it('flags an added tag not present in the source', () => {
    expect(tokenErrors('Save now', '<strong>今すぐ保存</strong>')).toEqual([
      'added </strong>, <strong>'
    ])
  })

  it('flags an empty translation of a non-empty source', () => {
    expect(tokenErrors('Save now', '')).toEqual(['empty translation'])
  })
})
