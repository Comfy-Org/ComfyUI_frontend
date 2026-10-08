import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { SpecFile } from './duration-shard-reporter'
import { planShards, testDurations } from './duration-shard-reporter'

function spec(file: string, title: string, ...durations: number[]) {
  return {
    title,
    file,
    tests: [{ results: durations.map((duration) => ({ duration })) }]
  }
}

function specFile(file: string, ...titles: string[]): SpecFile {
  return { file, tests: titles.map((title) => `${file} › ${title}`) }
}

describe('testDurations', () => {
  it('keys tests by file and describe titles, skipping anonymous describes', () => {
    const report = {
      suites: [
        {
          title: 'a.spec.ts',
          specs: [spec('a.spec.ts', 'top', 1000)],
          suites: [
            {
              title: 'Outer',
              suites: [
                { title: '', specs: [spec('a.spec.ts', 'nested', 2000)] }
              ]
            }
          ]
        }
      ]
    }

    expect(testDurations(report)).toEqual(
      new Map([
        ['a.spec.ts › top', 1000],
        ['a.spec.ts › Outer › nested', 2000]
      ])
    )
  })

  it('counts only the final attempt of a retried test', () => {
    const report = {
      suites: [
        { title: 'a.spec.ts', specs: [spec('a.spec.ts', 't', 30_000, 2000)] }
      ]
    }

    expect(testDurations(report)).toEqual(new Map([['a.spec.ts › t', 2000]]))
  })

  it('leaves out tests that never ran', () => {
    const report = {
      suites: [{ title: 'a.spec.ts', specs: [spec('a.spec.ts', 't')] }]
    }

    expect(testDurations(report)).toEqual(new Map())
  })

  it('rejects a file that is not a Playwright JSON report', () => {
    expect(() => testDurations({ stats: { expected: 1 } })).toThrow()
  })
})

describe('planShards', () => {
  it('balances shards by estimated duration, not test count', () => {
    const files = [
      specFile('big.spec.ts', 'slow'),
      specFile('many.spec.ts', 'm1', 'm2', 'm3', 'm4'),
      specFile('mid.spec.ts', 'x')
    ]
    const durations = new Map([
      ['big.spec.ts › slow', 9000],
      ['many.spec.ts › m1', 1000],
      ['many.spec.ts › m2', 1000],
      ['many.spec.ts › m3', 1000],
      ['many.spec.ts › m4', 1000],
      ['mid.spec.ts › x', 5000]
    ])

    expect(planShards(files, durations, 2)).toEqual([
      { files: ['big.spec.ts'], duration: 9000 },
      { files: ['mid.spec.ts', 'many.spec.ts'], duration: 9000 }
    ])
  })

  it.for([
    ['an odd', [1000, 3000, 8000], 3000],
    ['an even', [1000, 3000], 2000]
  ] satisfies [string, number[], number][])(
    'charges a test without a previous duration the median of %s count',
    ([, known, median]) => {
      const durations = new Map(
        known.map((duration, i) => [`old.spec.ts › ${i}`, duration])
      )

      expect(
        planShards([specFile('new.spec.ts', 'new')], durations, 1)
      ).toEqual([{ files: ['new.spec.ts'], duration: median }])
    }
  )

  it('splits by test count when no durations are known', () => {
    const files = [
      specFile('a.spec.ts', '1', '2', '3'),
      specFile('b.spec.ts', '1'),
      specFile('c.spec.ts', '1', '2')
    ]

    expect(planShards(files, new Map(), 2)).toEqual([
      { files: ['a.spec.ts'], duration: 3 },
      { files: ['c.spec.ts', 'b.spec.ts'], duration: 3 }
    ])
  })

  it.for([
    ['a.spec.ts', 'b.spec.ts'],
    ['b.spec.ts', 'a.spec.ts']
  ])(
    'breaks duration ties by file name when files arrive as %s, %s',
    (order) => {
      const durations = new Map([
        ['a.spec.ts › t', 1000],
        ['b.spec.ts › t', 1000]
      ])

      expect(
        planShards(
          order.map((file) => specFile(file, 't')),
          durations,
          2
        )
      ).toEqual([
        { files: ['a.spec.ts'], duration: 1000 },
        { files: ['b.spec.ts'], duration: 1000 }
      ])
    }
  )

  it.for([1, 2, 3, 7])(
    'assigns every file to exactly one of %i shards',
    (total) => {
      const files = ['a', 'b', 'c', 'd', 'e'].map((name) =>
        specFile(`${name}.spec.ts`, 't')
      )
      const durations = new Map([
        ['a.spec.ts › t', 4000],
        ['b.spec.ts › t', 1000],
        ['c.spec.ts › t', 7000],
        ['d.spec.ts › t', 2000],
        ['e.spec.ts › t', 3000]
      ])

      expect(
        planShards(files, durations, total)
          .flatMap((shard) => shard.files)
          .sort()
      ).toEqual([
        'a.spec.ts',
        'b.spec.ts',
        'c.spec.ts',
        'd.spec.ts',
        'e.spec.ts'
      ])
    }
  )
})

describe('DurationShardReporter in a Playwright run', () => {
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli')
  const config = fileURLToPath(
    new URL('./fixtures/duration-shard/playwright.config.ts', import.meta.url)
  )

  function writeReport(): string {
    const path = join(mkdtempSync(join(tmpdir(), 'duration-shard-')), 'r.json')
    const report = {
      suites: [
        {
          title: 'a.pw.ts',
          specs: [spec('a.pw.ts', 'a1', 1000), spec('a.pw.ts', 'a2', 1000)]
        },
        { title: 'b.pw.ts', specs: [spec('b.pw.ts', 'b', 5000)] },
        { title: 'c.pw.ts', specs: [spec('c.pw.ts', 'c', 1000)] }
      ]
    }
    writeFileSync(path, JSON.stringify(report))
    return path
  }

  function listShard(shard: string, durations: string) {
    const { status, stdout } = spawnSync(
      process.execPath,
      [cli, 'test', '--config', config, '--list', `--shard=${shard}`],
      {
        encoding: 'utf8',
        env: { ...process.env, PLAYWRIGHT_SHARD_DURATIONS: durations }
      }
    )
    const tests = stdout
      .split('\n')
      .filter((line) => line.startsWith('  [fixture] › '))
      .map((line) => line.trim().replace(/:\d+:\d+ › /, ' › '))
    return { status, tests }
  }

  it.for([
    ['1/2', ['[fixture] › b.pw.ts › b']],
    [
      '2/2',
      [
        '[fixture] › a.pw.ts › a1',
        '[fixture] › a.pw.ts › a2',
        '[fixture] › c.pw.ts › c'
      ]
    ]
  ] satisfies [string, string[]][])(
    'runs shard %s by previous duration',
    ([shard, expected]) => {
      expect(listShard(shard, writeReport())).toEqual({
        status: 0,
        tests: expected
      })
    }
  )

  it('leaves the split to Playwright when no durations are given', () => {
    expect(listShard('1/2', '')).toEqual({
      status: 0,
      tests: ['[fixture] › a.pw.ts › a1', '[fixture] › a.pw.ts › a2']
    })
  })

  it('fails the run when the durations file is missing', () => {
    expect(listShard('1/2', join(tmpdir(), 'no-such-report.json'))).toEqual({
      status: 1,
      tests: []
    })
  })
})
