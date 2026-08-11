import { describe, expect, it } from 'vitest'

import type { LocaleObject } from './update-locales'
import {
  diffLocaleSources,
  prepareLocale,
  validateLocale
} from './update-locales'

function translateMissing(
  source: LocaleObject,
  locale: LocaleObject
): LocaleObject {
  return {
    ...locale,
    added: `translated: ${source.added}`,
    changed: `translated: ${source.changed}`,
    list: source.list,
    protected: source.protected
  }
}

describe('locale update planning', () => {
  it('handles add, modify, delete, protected tokens, and an idempotent rerun', () => {
    const previous = {
      changed: 'Old {plan}',
      deleted: 'Delete me',
      list: ['Old {plan}'],
      stable: 'Keep me'
    }
    const current = {
      added: 'New {from} and {to}',
      changed: 'New {plan}',
      list: ['New {plan}'],
      protected:
        "Use <Picture i>, <Video k>, and <Audio j> with 17k+5, 'match', or 'max'.",
      stable: 'Keep me'
    }
    const changes = diffLocaleSources(previous, current)

    expect(changes).toEqual({
      added: [['added'], ['protected']],
      deleted: [['deleted']],
      modified: [['changed'], ['list']]
    })

    const locales = Array.from({ length: 12 }, (_, index) => ({
      changed: `stale ${index}`,
      deleted: `old ${index}`,
      list: [`stale ${index}`],
      stable: `stable ${index}`
    }))
    const firstRun = locales.map((locale) =>
      translateMissing(current, prepareLocale(locale, changes))
    )

    for (const locale of firstRun) {
      expect(validateLocale(current, locale, changes)).toEqual([])
      expect(locale).not.toHaveProperty('deleted')
    }

    const secondChanges = diffLocaleSources(current, current)
    expect(secondChanges).toEqual({ added: [], deleted: [], modified: [] })
    expect(
      firstRun.map((locale) => prepareLocale(locale, secondChanges))
    ).toEqual(firstRun)
  })

  it('rejects stale modified strings and corrupted protected syntax', () => {
    const previous = { changed: 'Old {plan}' }
    const current = {
      changed: 'New {plan}',
      protected: 'Use <Picture i> on the 17k+5 grid'
    }
    const changes = diffLocaleSources(previous, current)
    const corrupted = {
      ...prepareLocale(
        {
          changed: 'Old translation',
          protected: 'Use <Localized i> on the 17000+5 grid'
        },
        changes
      ),
      changed: 'New plan',
      protected: 'Use <Localized i> on the 17000+5 grid'
    }

    expect(validateLocale(current, corrupted, changes)).toEqual([
      'protected: missing 17k+5, <Picture i>',
      'changed: missing {plan}'
    ])
  })

  it('compares placeholder names as a set across plural forms', () => {
    const source = {
      count: 'No items | {count} item | {count} items'
    }
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
