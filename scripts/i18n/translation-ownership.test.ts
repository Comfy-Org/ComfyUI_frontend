import { describe, expect, it } from 'vitest'

import { collectLeaves, pathKey } from './locale-tree'
import {
  auditRetainedTranslations,
  machineTranslationsSchema,
  partitionOwnedLocale,
  projectLocale,
  translationDigest
} from './translation-ownership'

describe('translation ownership', () => {
  it.for([
    { value: '確認済み {name}', errors: [] },
    { value: '', errors: [] },
    { value: '確認済み', errors: ['title: missing {name}'] }
  ])('audits retained copy $value', ({ value, errors }) => {
    expect(
      auditRetainedTranslations(
        { title: 'Hello {name}' },
        new Map([[pathKey(['title']), value]])
      )
    ).toEqual(errors)
  })

  it.for([
    { label: 'reviewed copy', value: '確認済みの翻訳' },
    { label: 'intentional empty copy', value: '' }
  ])('retains $label while English is unchanged', ({ value }) => {
    const result = partitionOwnedLocale(
      { title: 'Revised English {name}' },
      { title: value },
      {},
      [],
      new Set()
    )

    expect(result.source).toEqual({})
    expect(result.retained).toEqual(new Map([[pathKey(['title']), value]]))
  })

  it.for([
    { label: 'reviewed copy', value: '確認済みの翻訳', machine: {} },
    {
      label: 'human-edited machine copy',
      value: '人が修正した翻訳',
      machine: { [pathKey(['title'])]: translationDigest('古い機械翻訳') }
    },
    { label: 'intentional empty copy', value: '', machine: {} }
  ])('requeues $label when English changes', ({ value, machine }) => {
    const result = partitionOwnedLocale(
      { title: 'Revised English {name}', unchanged: 'Unchanged English' },
      { title: value, unchanged: '確認済み' },
      machine,
      [],
      new Set([pathKey(['title'])])
    )

    expect(result.source).toEqual({ title: 'Revised English {name}' })
    expect(result.retained).toEqual(
      new Map([[pathKey(['unchanged']), '確認済み']])
    )
  })

  it('keeps unchanged machine copy eligible for source invalidation', () => {
    const result = partitionOwnedLocale(
      { title: 'Revised English' },
      { title: '古い機械翻訳' },
      { [pathKey(['title'])]: translationDigest('古い機械翻訳') },
      [],
      new Set()
    )

    expect(result.source).toEqual({ title: 'Revised English' })
    expect(result.retained.size).toBe(0)
  })

  it('retains human edits while English is unchanged', () => {
    const result = partitionOwnedLocale(
      { title: 'Revised English' },
      { title: '人が修正した翻訳' },
      { [pathKey(['title'])]: translationDigest('古い機械翻訳') },
      [],
      new Set()
    )

    expect(result.source).toEqual({})
    expect(result.retained).toEqual(
      new Map([[pathKey(['title']), '人が修正した翻訳']])
    )
  })

  it('excludes missing and machine-owned legal copy but keeps reviewed legal copy', () => {
    const result = partitionOwnedLocale(
      {
        tos: { missing: 'Missing', machine: 'Machine', reviewed: 'Reviewed' },
        tosExtra: 'Eligible'
      },
      { tos: { machine: '機械翻訳', reviewed: '確認済み' } },
      { [pathKey(['tos', 'machine'])]: translationDigest('機械翻訳') },
      ['tos'],
      new Set([pathKey(['tos', 'reviewed'])])
    )

    expect(result.source).toEqual({ tosExtra: 'Eligible' })
    expect(result.retained).toEqual(
      new Map([[pathKey(['tos', 'reviewed']), '確認済み']])
    )
  })

  it('withdraws translations whose English keys were removed', () => {
    const result = partitionOwnedLocale(
      {},
      { removed: '確認済み' },
      {},
      [],
      new Set()
    )

    expect(result.source).toEqual({})
    expect(result.retained.size).toBe(0)
  })

  it('projects reviewed and generated leaves without excluded or removed keys', () => {
    const generated = collectLeaves({ nested: { machine: '生成された翻訳' } })
    const values = new Map([
      ...[...generated].map(([key, leaf]) => [key, leaf.value] as const),
      [pathKey(['nested', 'reviewed']), ''],
      [pathKey(['removed']), '古い翻訳']
    ])

    expect(
      projectLocale(
        {
          nested: { machine: 'Generated', reviewed: 'Reviewed' },
          tos: 'Legal'
        },
        values
      )
    ).toEqual({ nested: { machine: '生成された翻訳', reviewed: '' } })
  })

  it('rejects corrupt ownership records', () => {
    expect(
      machineTranslationsSchema.safeParse({
        version: 1,
        files: { 'ja/main.json': { '["title"]': 'invalid' } }
      }).success
    ).toBe(false)
  })
})
