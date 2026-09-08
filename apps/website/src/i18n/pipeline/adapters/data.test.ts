import { describe, expect, it } from 'vitest'

import { dataAdapter, entriesFromSource } from './data'

/**
 * Keys feed the hash manifest, so a key that churns is a key the pipeline
 * re-sends to the model and pays for again. Everything here is about a key
 * staying put while the file around it moves.
 */
describe('entriesFromSource', () => {
  const keys = (file: string, source: string) =>
    entriesFromSource(file, source).map((entry) => entry.key)

  it('reads English as the source and other locales as approved', () => {
    const [entry] = entriesFromSource(
      'events.ts',
      `export const events = [
         { id: 'live', title: { en: 'Live', 'zh-CN': '直播' } }
       ]`
    )

    expect(entry).toEqual({
      key: 'events.live.title',
      english: 'Live',
      approved: { 'zh-CN': '直播' }
    })
  })

  it('identifies an item by its id, not its position', () => {
    const before = `export const d = [
       { id: 'a', title: { en: 'A' } },
       { id: 'b', title: { en: 'B' } }
     ]`
    const after = `export const d = [
       { id: 'b', title: { en: 'B' } },
       { id: 'a', title: { en: 'A' } }
     ]`

    expect(keys('d.ts', before).sort()).toEqual(keys('d.ts', after).sort())
  })

  it('roots the key at the declaration, so file-level constants differ', () => {
    // drops.ts declares several bare `const X: LocalizedText`. With the file
    // name alone every one of them collapsed onto the same key.
    expect(
      keys(
        'drops.ts',
        `const EXPLORE = { en: 'Explore' }
         const PLATFORM = { en: 'Platform' }`
      )
    ).toEqual(['drops.EXPLORE', 'drops.PLATFORM'])
  })

  it('does not repeat the file name when the declaration matches it', () => {
    //  exports , which produced
    // . 186 of 459 keys
    // read like that. Collapsing the repeat keeps them unique and readable.
    expect(
      keys(
        'affiliateBenefits.ts',
        "export const affiliateBenefits = [{ id: 'a', description: { en: 'X' } }]"
      )
    ).toEqual(['affiliateBenefits.a.description'])
  })

  it('still keeps both segments when they differ', () => {
    expect(keys('drops.ts', "const EXPLORE = { en: 'Explore' }")).toEqual([
      'drops.EXPLORE'
    ])
  })

  it('falls back to the index only when an item has no id', () => {
    expect(keys('d.ts', `export const d = [{ label: { en: 'One' } }]`)).toEqual(
      ['d.0.label']
    )
  })

  it('skips fields whose value is a URL rather than prose', () => {
    // `href` is LocalizedText because the type allows a per-locale link, not
    // because anyone wrote one — every pair in the repo is byte-identical.
    expect(
      keys(
        'events.ts',
        `export const e = [
           { id: 'x', title: { en: 'X' }, cta: { href: { en: 'https://a.b' } } }
         ]`
      )
    ).toEqual(['events.e.x.title'])
  })

  it('ignores an object that carries no English', () => {
    expect(keys('d.ts', `export const d = { count: 3, ok: true }`)).toEqual([])
  })

  it('never records English as an approved translation', () => {
    const [entry] = entriesFromSource(
      'd.ts',
      `export const d = { t: { en: 'Hi', 'zh-CN': '你好', ja: 'やあ' } }`
    )

    expect(entry.approved).toEqual({ 'zh-CN': '你好', ja: 'やあ' })
  })
})

/**
 * Against the real `src/data`, because the value of this adapter is that its
 * keys hold still across 17 files nobody wrote with a pipeline in mind. A count
 * would be a change detector; these are invariants that stay true as copy is
 * added.
 */
describe('the data adapter over src/data', () => {
  const entries = dataAdapter.read()

  it('finds copy in every data file that has any', () => {
    const files = new Set(entries.map((entry) => entry.key.split('.')[0]))
    expect(files.size).toBeGreaterThan(15)
  })

  it('gives every entry a unique key', () => {
    const seen = new Map<string, number>()
    for (const { key } of entries) seen.set(key, (seen.get(key) ?? 0) + 1)
    const collisions = [...seen].filter(([, n]) => n > 1).map(([key]) => key)

    expect(
      collisions,
      'two literals share a key, so one would overwrite the other'
    ).toEqual([])
  })

  it('never emits an entry with no English to translate', () => {
    expect(entries.filter((entry) => entry.english.trim() === '')).toEqual([])
  })

  it('reads the Chinese that is already there', () => {
    const withChinese = entries.filter((entry) => entry.approved['zh-CN'])
    expect(withChinese.length).toBe(entries.length)
  })
})
