import { describe, expect, it, vi } from 'vitest'

import type { OutputLocale } from './config'
import { translationTargets } from './config'
import type { LocaleObject } from './locale-tree'
import {
  collectPendingLeaves,
  diffLocaleSources,
  getLeaf,
  pathKey,
  rebuildLocale
} from './locale-tree'
import { leafTokensDiffer } from './protected-tokens'
import type { TranslateBatch } from './translate'
import { translateLocaleItems } from './translate'
import {
  assembleLeafTranslations,
  buildTranslationItems,
  formatPruneSummary,
  formatUsageSummary,
  parseOptions
} from './update-locales'

const locale: OutputLocale = { code: 'xx', name: 'Test Language' }

const translationConfig = {
  maxItemsPerRequest: 2,
  maxSourceCharsPerRequest: 1000,
  requestConcurrency: 1,
  maxTranslationRounds: 3,
  strictProtectedTokens: false
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
  const pendingLeaves = collectPendingLeaves(
    source,
    existing,
    invalidated,
    leafTokensDiffer
  )
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
  return { output, translatedCount: plan.items.length }
}

describe('diffLocaleSources', () => {
  it('reports added, modified, and deleted leaf paths, comparing arrays whole and types strictly', () => {
    const changes = diffLocaleSources(
      {
        changed: 'Old',
        deleted: 'Delete me',
        nested: { stable: 'Keep', count: 42 },
        steps: ['Open', 'Save']
      },
      {
        added: 'New',
        changed: 'New',
        nested: { stable: 'Keep', count: '42' },
        steps: ['Open', 'Export']
      }
    )
    expect(changes).toEqual({
      added: [['added']],
      deleted: [['deleted']],
      modified: [['changed'], ['nested', 'count'], ['steps']]
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
    expect(Object.keys(output)).toEqual(Object.keys(output).sort())
  })

  it('retranslates existing translations that were corrupted or blanked', async () => {
    const parity = {
      blanked: 'Save',
      farewell: 'Goodbye',
      greeting: 'Hello {name}',
      intact: 'See {docs}'
    }
    const corrupted = {
      blanked: '',
      farewell: 'translated ({count})',
      greeting: 'Bonjour nom',
      intact: 'translated {docs}'
    }
    const { output, translatedCount } = await updateLocaleFile(
      parity,
      parity,
      corrupted,
      echoTranslator
    )
    expect(output).toEqual({
      blanked: 'xx: Save',
      farewell: 'xx: Goodbye',
      greeting: 'xx: Hello {name}',
      intact: 'translated {docs}'
    })
    expect(translatedCount).toBe(3)
  })

  it('preserves keys named __proto__', async () => {
    const protoSource = JSON.parse(
      '{"__proto__": {"label": "Hello"}, "normal": "World"}'
    ) as LocaleObject
    const { output } = await updateLocaleFile(
      protoSource,
      {},
      {},
      echoTranslator
    )
    expect(Object.keys(output)).toEqual(['__proto__', 'normal'])
    expect(getLeaf(output, ['__proto__', 'label'])).toBe('xx: Hello')
    expect(getLeaf(output, ['normal'])).toBe('xx: World')
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

describe('parseOptions', () => {
  it.for([
    { argv: [], config: translationTargets.app, check: false },
    { argv: ['--check'], config: translationTargets.app, check: true },
    {
      argv: ['--target', 'website'],
      config: translationTargets.website,
      check: false
    },
    {
      argv: ['--target=website', '--check'],
      config: translationTargets.website,
      check: true
    },
    {
      argv: ['--target=website', '--target=app'],
      config: translationTargets.app,
      check: false
    }
  ])('selects the catalogs and mode for $argv', ({ argv, config, check }) => {
    const options = parseOptions(argv)
    expect(options.config).toBe(config)
    expect(options.check).toBe(check)
  })

  it.for([
    { argv: ['--target', 'docs'], message: 'Unknown translation target' },
    { argv: ['--target'], message: 'argument missing' },
    { argv: ['--chek'], message: 'Unknown option' }
  ])('rejects $argv', ({ argv, message }) => {
    expect(() => parseOptions(argv)).toThrow(message)
  })
})

describe('formatPruneSummary', () => {
  it('reports all source deletions without blocking on their size', () => {
    expect(formatPruneSummary('main.json', 0, 100)).toBeUndefined()
    expect(formatPruneSummary('main.json', 1, 100)).toBe(
      'WARNING: main.json: 1 of 100 English keys deleted; matching locale keys will be pruned.'
    )
    expect(formatPruneSummary('nodeDefs.json', 387, 9082)).toBe(
      'WARNING: nodeDefs.json: 387 of 9082 English keys deleted; matching locale keys will be pruned.'
    )
  })
})

describe('formatUsageSummary', () => {
  it('sums usage across responses and tolerates missing fields', () => {
    expect(
      formatUsageSummary(
        [
          {
            input_tokens: 10,
            output_tokens: 4,
            total_tokens: 14,
            output_tokens_details: { reasoning_tokens: 2 }
          },
          undefined,
          { total_tokens: 100 }
        ],
        7
      )
    ).toBe(
      'OpenAI usage: 7 HTTP requests for 3 responses; 10 input, 4 output (2 reasoning), 114 total tokens.'
    )
  })
})
