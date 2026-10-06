import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'

import { publishCatalogs, recoverPublication } from './publication'

const JOURNAL = '.locale-publication.json'

interface SavedEntry {
  path: string
  old: string | null
  new: string | null
}

function createOutputDir(files: Record<string, string> = {}): string {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'publish-')))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    writeFileSync(path.join(directory, file), contents)
  }
  return directory
}

function saveJournal(directory: string, journal: unknown): void {
  writeFileSync(path.join(directory, JOURNAL), JSON.stringify(journal))
}

function readTree(directory: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(directory, { recursive: true, encoding: 'utf8' })
      .filter((file) => statSync(path.join(directory, file)).isFile())
      .sort()
      .map((file) => [
        file.split(path.sep).join('/'),
        readFileSync(path.join(directory, file), 'utf8')
      ])
  )
}

function readInputs(directory: string): Map<string, string> {
  return new Map(
    Object.entries(readTree(directory)).map(([file, bytes]) => [
      path.join(directory, file),
      bytes
    ])
  )
}

describe('publishCatalogs', () => {
  it('writes and deletes catalogs, then leaves no journal or temp files', () => {
    const directory = createOutputDir({
      'ja/main.json': '{"old":true}',
      'fr/obsolete.json': '{}',
      'ko/main.json': '{"same":true}'
    })
    const updates = new Map([
      [path.join(directory, 'ja/main.json'), '{"new":true}'],
      [path.join(directory, 'zh/main.json'), '{"created":true}'],
      [path.join(directory, 'fr/obsolete.json'), null],
      [path.join(directory, 'ko/main.json'), '{"same":true}']
    ])

    publishCatalogs(directory, updates, readInputs(directory))
    publishCatalogs(directory, updates, readInputs(directory))

    expect(readTree(directory)).toEqual({
      'ja/main.json': '{"new":true}',
      'ko/main.json': '{"same":true}',
      'zh/main.json': '{"created":true}'
    })
  })

  it.for([
    { label: 'a path outside the output directory', target: '../escape.json' },
    { label: 'the journal itself', target: JOURNAL },
    { label: 'a temp file name', target: 'ja/main.json.publication.tmp' },
    { label: 'the output directory', target: '.' }
  ])('rejects $label without writing', ({ target }) => {
    const directory = createOutputDir({ 'ja/main.json': 'old' })

    expect(() =>
      publishCatalogs(
        directory,
        new Map([
          [path.join(directory, 'ja/main.json'), 'new'],
          [path.join(directory, target), 'x']
        ]),
        readInputs(directory)
      )
    ).toThrow(/inside/)
    expect(readTree(directory)).toEqual({ 'ja/main.json': 'old' })
  })

  it('rejects relative keys and aliases of the same file', () => {
    const directory = createOutputDir()

    expect(() =>
      publishCatalogs(directory, new Map([['ja/main.json', 'x']]), new Map())
    ).toThrow(/absolute/)
    expect(() =>
      publishCatalogs(
        directory,
        new Map([
          [path.join(directory, 'ja/main.json'), 'x'],
          [`${directory}/ja/../ja/main.json`, 'y']
        ]),
        readInputs(directory)
      )
    ).toThrow(/duplicate path ja\/main.json/)
    expect(readTree(directory)).toEqual({})
  })

  it('refuses to start while another publication is pending', () => {
    const directory = createOutputDir({ 'ja/main.json': 'old' })
    const pending = {
      version: 1,
      files: [{ path: 'ja/main.json', old: 'old', new: 'pending' }]
    }
    saveJournal(directory, pending)

    expect(() =>
      publishCatalogs(
        directory,
        new Map([[path.join(directory, 'ja/main.json'), 'other']]),
        readInputs(directory)
      )
    ).toThrow(/already pending/)
    expect(readTree(directory)).toEqual({
      [JOURNAL]: JSON.stringify(pending),
      'ja/main.json': 'old'
    })
  })

  it('keeps a recoverable journal and removes temp files when a replacement fails', () => {
    const directory = createOutputDir()

    expect(() =>
      publishCatalogs(
        directory,
        new Map([
          [path.join(directory, 'ja/main.json'), 'nested'],
          [path.join(directory, 'ja'), 'blocked by directory']
        ]),
        readInputs(directory)
      )
    ).toThrow()

    expect(Object.keys(readTree(directory))).toEqual([JOURNAL, 'ja/main.json'])
    expect(
      JSON.parse(readFileSync(path.join(directory, JOURNAL), 'utf8'))
    ).toEqual({
      version: 1,
      files: [
        { path: 'ja/main.json', old: null, new: 'nested' },
        { path: 'ja', old: null, new: 'blocked by directory' }
      ]
    })
  })
})

describe('recoverPublication', () => {
  const interrupted: SavedEntry[] = [
    { path: 'ja/main.json', old: 'ja old', new: 'ja new' },
    { path: 'zh/main.json', old: null, new: 'zh new' },
    { path: 'fr/main.json', old: 'fr old', new: null },
    {
      path: '.locale-manifest.json',
      old: '{"source":"aaa"}',
      new: '{"source":"bbb"}'
    }
  ]

  it('finishes the recorded snapshot after one file was replaced, idempotently', () => {
    const directory = createOutputDir({
      'ja/main.json': 'ja new',
      'fr/main.json': 'fr old',
      '.locale-manifest.json': '{"source":"aaa"}'
    })
    saveJournal(directory, { version: 1, files: interrupted })

    recoverPublication(directory)
    recoverPublication(directory)

    expect(readTree(directory)).toEqual({
      '.locale-manifest.json': '{"source":"bbb"}',
      'ja/main.json': 'ja new',
      'zh/main.json': 'zh new'
    })
  })

  it('refuses every write when any listed file was edited after publication started', () => {
    const directory = createOutputDir({
      'ja/main.json': 'ja old',
      'fr/main.json': 'fr old',
      'zh/main.json': 'human edit',
      '.locale-manifest.json': '{"source":"aaa"}'
    })
    saveJournal(directory, { version: 1, files: interrupted })
    const before = readTree(directory)

    expect(() => recoverPublication(directory)).toThrow(
      /changed after it started: zh\/main\.json\. No files were written\. Restore each listed file/
    )
    expect(readTree(directory)).toEqual(before)
  })

  it.for([
    { label: 'a truncated journal', raw: '{"version":1,"files":[{"pa' },
    {
      label: 'an unknown version',
      raw: JSON.stringify({ version: 2, files: interrupted })
    },
    {
      label: 'a missing field',
      raw: JSON.stringify({ version: 1, files: [{ path: 'a', old: null }] })
    },
    {
      label: 'a parent traversal',
      raw: JSON.stringify({
        version: 1,
        files: [{ path: '../escape.json', old: null, new: 'x' }]
      })
    },
    {
      label: 'an unnormalized traversal',
      raw: JSON.stringify({
        version: 1,
        files: [{ path: 'ja/../../escape.json', old: null, new: 'x' }]
      })
    },
    {
      label: 'an absolute path',
      raw: JSON.stringify({
        version: 1,
        files: [{ path: '/tmp/escape.json', old: null, new: 'x' }]
      })
    },
    {
      label: 'duplicate paths',
      raw: JSON.stringify({
        version: 1,
        files: [
          { path: 'ja/main.json', old: 'ja old', new: 'a' },
          { path: 'ja/main.json', old: 'ja old', new: 'b' }
        ]
      })
    }
  ])('fails closed on $label without writing', ({ raw }) => {
    const directory = createOutputDir({ 'ja/main.json': 'ja old' })
    writeFileSync(path.join(directory, JOURNAL), raw)
    const before = readTree(directory)

    expect(() => recoverPublication(directory)).toThrow(
      /Locale publication journal .* (is not valid JSON|is invalid).*delete/
    )
    expect(readTree(directory)).toEqual(before)
  })

  it('does nothing without a pending journal', () => {
    const directory = createOutputDir({ 'ja/main.json': 'ja old' })

    recoverPublication(directory)

    expect(readTree(directory)).toEqual({ 'ja/main.json': 'ja old' })
  })
})
