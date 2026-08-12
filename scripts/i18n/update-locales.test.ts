import { describe, expect, it, vi } from 'vitest'

import type { OutputLocale } from './config'
import type { LocaleObject } from './locale-tree'
import {
  collectPendingLeaves,
  diffLocaleSources,
  pathKey,
  rebuildLocale
} from './locale-tree'
import { validateLocale } from './protected-tokens'
import type { TranslateBatch, TranslationItem } from './translate'
import { chunkItems, translateLocaleItems } from './translate'
import {
  assembleLeafTranslations,
  buildTranslationItems
} from './update-locales'

const locale: OutputLocale = { code: 'xx', name: 'Test Language' }

const translationConfig = {
  maxItemsPerRequest: 2,
  maxSourceCharsPerRequest: 1000,
  requestConcurrency: 1,
  maxTranslationRounds: 3
}

const echoTranslator: TranslateBatch = (batchLocale, items) =>
  Promise.resolve(
    Object.fromEntries(
      items.map((item) => [item.id, `${batchLocale.code}: ${item.source}`])
    )
  )

async function updateLocaleFile(
  source: LocaleObject,
  previous: LocaleObject,
  existing: LocaleObject,
  translateBatch: TranslateBatch
): Promise<{ output: LocaleObject; translatedCount: number }> {
  const changes = diffLocaleSources(previous, source)
  const invalidated = new Set(
    [...changes.added, ...changes.modified].map(pathKey)
  )
  const pendingLeaves = collectPendingLeaves(source, existing, invalidated)
  const plan = buildTranslationItems('main.json', pendingLeaves)
  const translations =
    plan.items.length > 0
      ? await translateLocaleItems(
          locale,
          plan.items,
          translateBatch,
          translationConfig
        )
      : new Map<string, string>()
  const output = rebuildLocale(
    source,
    existing,
    invalidated,
    assembleLeafTranslations(pendingLeaves, plan, translations)
  )
  expect(validateLocale(source, output, changes)).toEqual([])
  return { output, translatedCount: plan.items.length }
}

describe('diffLocaleSources', () => {
  it('reports added, modified, and deleted leaf paths', () => {
    const changes = diffLocaleSources(
      { changed: 'Old {plan}', deleted: 'Delete me', stable: 'Keep me' },
      { added: 'New string', changed: 'New {plan}', stable: 'Keep me' }
    )
    expect(changes).toEqual({
      added: [['added']],
      deleted: [['deleted']],
      modified: [['changed']]
    })
  })
})

describe('locale file update', () => {
  const previous = {
    changed: 'Old {plan}',
    deleted: 'Delete me',
    nested: { count: 42, note: 'A note' },
    stable: 'Keep me'
  }
  const source = {
    added: 'New {from} and {to}',
    changed: 'New {plan}',
    list: ['First cause', '', 'Third cause'],
    nested: { count: 42, note: 'A note' },
    protected:
      "Use <Picture i>, <Video k>, and <Audio j> with 17k+5, 'match', or 'max'.",
    stable: 'Keep me'
  }
  const existing = {
    changed: 'stale translation',
    deleted: 'old translation',
    nested: { count: 42, note: 'translated note' },
    stable: 'translated keep me',
    stray: 'no longer in source'
  }

  it('translates added, modified, and missing values; prunes deleted and stray keys; keeps valid translations', async () => {
    const { output, translatedCount } = await updateLocaleFile(
      source,
      previous,
      existing,
      echoTranslator
    )

    expect(output).toEqual({
      added: 'xx: New {from} and {to}',
      changed: 'xx: New {plan}',
      list: ['xx: First cause', '', 'xx: Third cause'],
      nested: { count: 42, note: 'translated note' },
      protected:
        "xx: Use <Picture i>, <Video k>, and <Audio j> with 17k+5, 'match', or 'max'.",
      stable: 'translated keep me'
    })
    expect(translatedCount).toBe(5)
    expect(Object.keys(output)).toEqual([...Object.keys(output)].sort())
  })

  it('is idempotent: a rerun translates nothing and leaves the output unchanged', async () => {
    const { output } = await updateLocaleFile(
      source,
      previous,
      existing,
      echoTranslator
    )
    const untouchedTranslator = vi.fn<TranslateBatch>()
    const rerun = await updateLocaleFile(
      source,
      source,
      output,
      untouchedTranslator
    )
    expect(rerun.output).toEqual(output)
    expect(rerun.translatedCount).toBe(0)
    expect(untouchedTranslator).not.toHaveBeenCalled()
  })
})

describe('translateLocaleItems', () => {
  const items: TranslationItem[] = [
    {
      id: '1',
      context: 'main.json: greeting',
      source: 'Hello {name}',
      preserve: ['{name}']
    }
  ]

  it('retries items whose translation corrupts protected tokens', async () => {
    let calls = 0
    const flaky: TranslateBatch = (_batchLocale, batch) => {
      calls++
      return Promise.resolve(
        Object.fromEntries(
          batch.map((item) => [
            item.id,
            calls === 1 ? 'Bonjour name' : 'Bonjour {name}'
          ])
        )
      )
    }
    const translations = await translateLocaleItems(
      locale,
      items,
      flaky,
      translationConfig
    )
    expect(translations.get('1')).toBe('Bonjour {name}')
    expect(calls).toBe(2)
  })

  it('fails after exhausting rounds when tokens stay corrupted', async () => {
    const corrupting: TranslateBatch = (_batchLocale, batch) =>
      Promise.resolve(
        Object.fromEntries(batch.map((item) => [item.id, 'Bonjour name']))
      )
    await expect(
      translateLocaleItems(locale, items, corrupting, translationConfig)
    ).rejects.toThrow(/failed for 1 strings/)
  })

  it('ignores response ids that were not requested in the same chunk', async () => {
    const threeItems: TranslationItem[] = ['1', '2', '3'].map((id) => ({
      id,
      context: `main.json: key${id}`,
      source: `Source ${id}`,
      preserve: []
    }))
    const responses: Array<Record<string, string>> = [
      { '1': 'ok1', '2': 'ok2', '3': 'WRONG' },
      {},
      { '3': 'ok3' }
    ]
    let call = 0
    const crossTalking: TranslateBatch = () =>
      Promise.resolve(responses[call++] ?? {})
    const translations = await translateLocaleItems(
      locale,
      threeItems,
      crossTalking,
      translationConfig
    )
    expect(translations.get('3')).toBe('ok3')
  })

  it('sends a retry note naming the violation on later rounds', async () => {
    const seenNotes: Array<string | undefined> = []
    const flaky: TranslateBatch = (_batchLocale, batch) => {
      seenNotes.push(batch[0].retryNote)
      return Promise.resolve(
        Object.fromEntries(
          batch.map((item) => [
            item.id,
            seenNotes.length === 1 ? 'Bonjour {nom}' : 'Bonjour {name}'
          ])
        )
      )
    }
    await translateLocaleItems(locale, items, flaky, translationConfig)
    expect(seenNotes[0]).toBeUndefined()
    expect(seenNotes[1]).toContain('missing {name}')
    expect(seenNotes[1]).toContain('added {nom}')
  })
})

describe('chunkItems', () => {
  it('splits by item count and source size while keeping oversized items whole', () => {
    const item = (id: string, size: number): TranslationItem => ({
      id,
      context: id,
      source: 'x'.repeat(size),
      preserve: []
    })
    const chunks = chunkItems(
      [item('1', 10), item('2', 10), item('3', 90), item('4', 200)],
      3,
      100
    )
    expect(chunks.map((chunk) => chunk.map(({ id }) => id))).toEqual([
      ['1', '2'],
      ['3'],
      ['4']
    ])
  })
})

describe('validateLocale', () => {
  it('rejects stale modified strings and corrupted protected syntax', () => {
    const previous = { changed: 'Old {plan}' }
    const source = {
      changed: 'New {plan}',
      protected: 'Use <Picture 10> on the 17k+5 grid'
    }
    const changes = diffLocaleSources(previous, source)
    const corrupted = {
      changed: 'New plan',
      protected: 'Use <Localized 10> on the 17000+5 grid'
    }
    expect(validateLocale(source, corrupted, changes)).toEqual([
      'protected: missing 17k+5, <Picture 10>',
      'changed: missing {plan}'
    ])
  })

  it('protects positional and literal interpolation placeholders', () => {
    const source = { help: "Ask {'@'}{username} or check {0}" }
    const changes = diffLocaleSources({}, source)
    expect(
      validateLocale(
        source,
        { help: "Demandez à {'@'}{username} ou consultez {0}" },
        changes
      )
    ).toEqual([])
    expect(
      validateLocale(
        source,
        { help: 'Demandez à @username ou consultez 0' },
        changes
      )
    ).toEqual(["help: missing {'@'}, {0}, {username}"])
  })

  it('flags keys that no longer exist in the source', () => {
    const source = { stable: 'Keep me' }
    const changes = diffLocaleSources(source, source)
    expect(
      validateLocale(
        source,
        { stable: 'translated', stray: 'left behind' },
        changes
      )
    ).toEqual(['stray: key does not exist in the source'])
  })

  it('compares placeholder names as a set across plural forms', () => {
    const source = { count: 'No items | {count} item | {count} items' }
    const changes = diffLocaleSources({}, source)
    expect(
      validateLocale(
        source,
        { count: 'None | {count} one | {count} many' },
        changes
      )
    ).toEqual([])
    expect(
      validateLocale(source, { count: 'None | {total} many' }, changes)
    ).toEqual(['count: missing {count}', 'count: added {total}'])
  })
})
