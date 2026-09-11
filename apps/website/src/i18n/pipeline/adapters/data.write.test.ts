import { describe, expect, it } from 'vitest'

import { applyEdits, entriesFromSource, planLocale } from './data'

/**
 * The writer edits hand-written TypeScript, which is the riskiest thing in this
 * phase. It is split so the risk is structural rather than tested-for:
 * `planLocale` decides *where* and *what*, and `applyEdits` can only rebuild
 * the file from slices of the original with new text between them. The only
 * bytes it can drop are the ones a plan explicitly names, and a plan only ever
 * names a string literal the pipeline itself wrote.
 */
describe('planLocale', () => {
  const FILE = 'd.ts'
  const SOURCE = `export const d = {
  title: {
    en: 'Live',
    'zh-CN': '直播'
  },
  note: {
    en: 'Soon'
  }
}
`

  it('plans one edit per translated key and none for the rest', () => {
    const plan = planLocale('ja', FILE, SOURCE, { 'd.title': 'ライブ' })

    expect(plan).toHaveLength(1)
    expect(plan[0].length).toBe(0)
  })

  it('marks what it writes as machine output', () => {
    // Without the marker a machine value reads back as approved, and approved
    // values are never re-sent to the model — so the next English edit would
    // leave Japanese frozen at the old wording, silently.
    const [edit] = planLocale('ja', FILE, SOURCE, { 'd.title': 'ライブ' })

    expect(edit.text).toBe(",\n    ja: 'ライブ' /* machine */")
  })

  /**
   * The writer used to hardcode `ja`. Every locale the pipeline fills reaches
   * the same data files, so the property it inserts has to be the one it was
   * asked for — and `zh-CN` is not a valid identifier, so it has to be quoted
   * or the file it writes will not parse.
   */
  it('writes the locale it was given', () => {
    const [edit] = planLocale('fr', FILE, SOURCE, { 'd.note': 'Bientôt' })

    expect(edit.text).toBe(",\n    fr: 'Bientôt' /* machine */")
  })

  it('quotes a locale that is not a valid identifier', () => {
    const [edit] = planLocale('zh-CN', FILE, SOURCE, { 'd.note': '即将推出' })

    expect(edit.text).toBe(",\n    'zh-CN': '即将推出' /* machine */")
  })

  it('indents to match the property it follows', () => {
    const [edit] = planLocale('ja', FILE, SOURCE, { 'd.note': 'まもなく' })

    expect(edit.text).toBe(",\n    ja: 'まもなく' /* machine */")
  })

  it('stays on one line when the object it edits is on one line', () => {
    // Two reasons. Forcing a newline into a single-line literal makes oxfmt
    // expand the whole object, turning a one-line insertion into a five-line
    // diff — and a `//` marker here would comment out the closing brace.
    const inline = `export const d = { t: { en: 'A', 'zh-CN': 'B' } }\n`

    const [edit] = planLocale('ja', FILE, inline, { 'd.t': 'あ' })

    expect(edit.text).toBe(", ja: 'あ' /* machine */")
  })

  it('refuses to touch Japanese a person wrote', () => {
    const human = `export const d = {
  title: { en: 'Live', 'zh-CN': '直播', ja: 'ライブ' }
}
`
    expect(planLocale('ja', FILE, human, { 'd.title': 'べつ' })).toEqual([])
  })

  it('replaces its own earlier output when the English moved on', () => {
    const mine = `export const d = {
  title: {
    en: 'Live',
    'zh-CN': '直播',
    ja: 'ふるい' /* machine */
  }
}
`
    const [edit] = planLocale('ja', FILE, mine, { 'd.title': 'あたらしい' })

    // Only the string literal's own bytes are named for replacement.
    expect(mine.slice(edit.offset, edit.offset + edit.length)).toBe("'ふるい'")
    expect(edit.text).toBe("'あたらしい'")
  })

  it('leaves its own output alone when the translation is unchanged', () => {
    const mine = `export const d = {
  title: { en: 'Live', 'zh-CN': '直播', ja: 'ライブ' /* machine */ }
}
`
    expect(planLocale('ja', FILE, mine, { 'd.title': 'ライブ' })).toEqual([])
  })

  it('plans nothing for a key the file does not contain', () => {
    expect(planLocale('ja', FILE, SOURCE, { 'd.missing': 'x' })).toEqual([])
  })

  it('escapes a backslash and a newline', () => {
    const [edit] = planLocale('ja', FILE, SOURCE, {
      'd.note': 'a \\ back\nslash'
    })

    expect(edit.text).toBe(
      ',\n    ja: ' + String.raw`'a \\ back\nslash'` + ' /* machine */'
    )
  })

  it('switches to double quotes rather than escape an apostrophe', () => {
    // What oxfmt does anyway. Matching it keeps `pnpm format` a no-op on the
    // writer's output, so the diff a reviewer reads is the diff we made.
    const [edit] = planLocale('ja', FILE, SOURCE, { 'd.note': "it's here" })

    expect(edit.text).toBe(`,\n    ja: "it's here" /* machine */`)
  })

  it('escapes the quote it chose when the value contains both kinds', () => {
    const [edit] = planLocale('ja', FILE, SOURCE, {
      'd.note': `it's a "quote"`
    })

    expect(edit.text).toBe(`,\n    ja: 'it\\'s a "quote"' /* machine */`)
  })
})

describe('applyEdits', () => {
  it('preserves every byte it was not told to replace', () => {
    const original = 'abcdef'

    const result = applyEdits(original, [
      { offset: 2, length: 0, text: 'XX' },
      { offset: 5, length: 0, text: 'Y' }
    ])

    expect(result).toBe('abXXcdeYf')
    expect(result.replace('XX', '').replace('Y', '')).toBe(original)
  })

  it('replaces exactly the named range and nothing around it', () => {
    expect(applyEdits('abcdef', [{ offset: 2, length: 2, text: 'Z' }])).toBe(
      'abZef'
    )
  })

  it('does not care what order the edits arrive in', () => {
    expect(
      applyEdits('abcdef', [
        { offset: 5, length: 0, text: 'Y' },
        { offset: 2, length: 0, text: 'XX' }
      ])
    ).toBe('abXXcdeYf')
  })
})

describe('a written file re-reads as the same file plus Japanese', () => {
  const FILE = 'events.ts'
  const SOURCE = `export const events = [
  {
    id: 'live',
    title: {
      en: 'ComfyUI Live',
      'zh-CN': 'ComfyUI 直播'
    },
    description: {
      en: 'A weekly stream',
      'zh-CN': '每周直播'
    }
  }
]
`

  it('adds Japanese without disturbing English or Chinese', () => {
    const japanese = {
      'events.live.title': 'ComfyUI ライブ',
      'events.live.description': '毎週の配信'
    }

    const written = applyEdits(SOURCE, planLocale('ja', FILE, SOURCE, japanese))

    const before = entriesFromSource(FILE, SOURCE)
    const after = entriesFromSource(FILE, written)

    expect(after.map((entry) => entry.key)).toEqual(
      before.map((entry) => entry.key)
    )
    expect(after.map((entry) => entry.english)).toEqual(
      before.map((entry) => entry.english)
    )
    expect(after.map((entry) => entry.approved['zh-CN'])).toEqual(
      before.map((entry) => entry.approved['zh-CN'])
    )
  })

  it('does not report its own Japanese as approved', () => {
    // The whole point of the marker: an approved value is never re-sent to the
    // model, so machine output that read back as approved could never be
    // refreshed when its English changed.
    const written = applyEdits(
      SOURCE,
      planLocale('ja', FILE, SOURCE, {
        'events.live.title': 'ComfyUI ライブ'
      })
    )

    const entries = entriesFromSource(FILE, written)

    expect(written).toContain('ComfyUI ライブ')
    expect(entries.every((entry) => entry.approved.ja === undefined)).toBe(true)
  })
})

describe('a translation the pipeline has withdrawn', () => {
  const FILE = 'd.ts'

  /** A file the writer has already filled, as it exists between runs. */
  const WRITTEN = `export const d = {
  title: {
    en: 'Live',
    'zh-CN': '直播',
    ja: 'ライブ' /* machine */
  }
}
`

  /**
   * The defect this exists for. `enforce` drops a rejected translation from
   * `content/ja.json`, so the key simply stops being supplied here. The writer
   * skipped anything it had no value for, which left the rejected Japanese
   * sitting in the file — and the page kept rendering it. Enforcement was
   * cosmetic for anything already written.
   */
  it('removes the machine-written Japanese it can no longer justify', () => {
    const plan = planLocale('ja', FILE, WRITTEN, {})

    expect(plan).toHaveLength(1)
    expect(applyEdits(WRITTEN, plan)).not.toContain('ライブ')
    expect(applyEdits(WRITTEN, plan)).toContain("'zh-CN': '直播'")
    expect(applyEdits(WRITTEN, plan)).toContain("en: 'Live'")
  })

  /** A person's translation is never the pipeline's to withdraw. */
  it('leaves a hand-written Japanese translation alone', () => {
    const HUMAN = WRITTEN.replace(' /* machine */', '')

    expect(planLocale('ja', FILE, HUMAN, {})).toEqual([])
  })

  it('still writes nothing for a key that never had Japanese', () => {
    const BARE = `export const d = {
  title: {
    en: 'Live'
  }
}
`

    expect(planLocale('ja', FILE, BARE, {})).toEqual([])
  })
})

/**
 * Where the withdrawn property sits decides which comma has to go with it.
 * Removing the property alone leaves the separator behind and the object stops
 * parsing — `{ , en: 'A' }` was the first attempt at this.
 */
describe('a withdrawn property leaves no comma behind', () => {
  const withdraw = (source: string) =>
    applyEdits(source, planLocale('ja', 'd.ts', source, {}))

  it('when it is last', () => {
    expect(
      withdraw(
        `export const d = {\n  t: {\n    en: 'A',\n    ja: 'あ' /* machine */\n  }\n}\n`
      )
    ).toBe(`export const d = {\n  t: {\n    en: 'A'\n  }\n}\n`)
  })

  it('when it is first', () => {
    expect(
      withdraw(
        `export const d = {\n  t: {\n    ja: 'あ' /* machine */,\n    en: 'A'\n  }\n}\n`
      )
    ).toBe(`export const d = {\n  t: {\n    en: 'A'\n  }\n}\n`)
  })

  it('when it is in the middle', () => {
    expect(
      withdraw(
        `export const d = {\n  t: {\n    en: 'A',\n    ja: 'あ' /* machine */,\n    'zh-CN': '中'\n  }\n}\n`
      )
    ).toBe(
      `export const d = {\n  t: {\n    en: 'A',\n    'zh-CN': '中'\n  }\n}\n`
    )
  })
})
