import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assert, describe, expect, it, onTestFinished } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const script = join(import.meta.dirname, 'plan-playwright-videos.sh')
const bash = '/bin/bash'
const playwright = fileURLToPath(import.meta.resolve('@playwright/test'))
const bin = join(import.meta.dirname, '../../node_modules/.bin')

function fixture(
  chromiumCount: number,
  cloudCount = 0,
  extraChromiumCounts: number[] = []
) {
  const root = mkdtempSync(join(tmpdir(), 'playwright-video-plan-'))
  const config = join(root, 'playwright.config.ts')
  const spec = join(root, 'changed.spec.ts')
  const source = (count: number, tag = '') =>
    Array.from(
      { length: count },
      (_, i) => `test('case ${i} ${tag}', () => {})`
    ).join('\n')
  writeFileSync(
    config,
    `export default {
      testDir: ${JSON.stringify(root)},
      fullyParallel: true,
      projects: [
        { name: 'chromium', grepInvert: /@cloud|@audit/ },
        { name: 'cloud', grep: /@cloud/ }
      ]
    }`
  )
  const imports = `import { test } from ${JSON.stringify(playwright)}\n`
  writeFileSync(
    spec,
    imports +
      [
        source(chromiumCount),
        source(cloudCount, '@cloud'),
        source(1, '@audit')
      ].join('\n')
  )
  writeFileSync(join(root, 'unrelated.spec.ts'), imports + source(100))
  mkdirSync(join(root, 'bin'))
  writeFileSync(
    join(root, 'bin', 'pnpm'),
    `#!/bin/sh\nshift\nexec ${JSON.stringify(bin)}/"$@"\n`,
    { mode: 0o755 }
  )
  const extraSpecs = extraChromiumCounts.map((count, i) => {
    const file = join(root, `extra-${i}.spec.ts`)
    writeFileSync(file, imports + source(count))
    return file
  })

  return {
    spec,
    root,
    run(env: Record<string, string> = {}) {
      return spawnSync(
        'bash',
        [script, '--config', config, spec, ...extraSpecs],
        {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(root, 'bin')}:${process.env.PATH}`,
            PLAYWRIGHT_JSON_OUTPUT_NAME: '',
            ...env
          }
        }
      )
    },
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

describe('Playwright video shard planning', () => {
  it.for([
    [0, 0],
    [1, 1],
    [801, 1]
  ] satisfies [number, number][])(
    'plans %i discovered tests into %i shards',
    ([count, shards]) => {
      using files = fixture(count)
      const result = files.run()

      expect(result).toMatchObject({ status: 0 })
      expect(JSON.parse(result.stdout).matrix).toEqual({
        include: Array.from({ length: shards }, (_, i) => ({
          project: 'chromium',
          shardIndex: i + 1,
          shardTotal: shards,
          specs: [{ file: expect.any(String), key: expect.any(String) }]
        }))
      })
    }
  )

  it.for([
    [
      'balances whole specs by test count',
      60,
      [30, 30, 10],
      [
        ['changed.spec.ts'],
        ['extra-0.spec.ts', 'extra-2.spec.ts'],
        ['extra-1.spec.ts']
      ]
    ],
    [
      'plans at most one shard per spec',
      100,
      [100],
      [['changed.spec.ts'], ['extra-0.spec.ts']]
    ]
  ] satisfies [string, number, number[], string[][]][])(
    '%s',
    ([, changedCount, extraCounts, shards]) => {
      using files = fixture(changedCount, 0, extraCounts)
      const result = files.run()

      expect(result).toMatchObject({ status: 0 })
      expect(
        JSON.parse(result.stdout).matrix.include.map(
          (shard: { specs: { file: string }[] }) =>
            shard.specs.map(({ file }) => basename(file))
        )
      ).toEqual(shards)
    }
  )

  it('routes mixed specs through Playwright and excludes audit-only tests', () => {
    using files = fixture(51, 2)
    const result = files.run()

    expect(result).toMatchObject({ status: 0 })
    expect(
      JSON.parse(result.stdout).matrix.include.map(
        ({ project, shardTotal }: { project: string; shardTotal: number }) => [
          project,
          shardTotal
        ]
      )
    ).toEqual([
      ['chromium', 1],
      ['cloud', 1]
    ])
  })

  it(
    'records only specs whose key is missing from the cache index',
    { timeout: 30_000 },
    () => {
      using files = fixture(3, 1)
      const planned = JSON.parse(files.run({ VIDEO_CACHE_SALT: 'a' }).stdout)
      const chromium = planned.matrix.include.find(
        (shard: { project: string }) => shard.project === 'chromium'
      )
      const index = join(files.root, 'index.txt')
      writeFileSync(index, `${chromium.specs[0].key}\tabc1234\n`)

      const cached = JSON.parse(
        files.run({ VIDEO_CACHE_SALT: 'a', VIDEO_CACHE_INDEX: index }).stdout
      )
      const resalted = JSON.parse(
        files.run({ VIDEO_CACHE_SALT: 'b', VIDEO_CACHE_INDEX: index }).stdout
      )

      expect(cached.hits).toEqual([
        {
          key: chromium.specs[0].key,
          project: 'chromium',
          file: 'changed.spec.ts',
          sha: 'abc1234'
        }
      ])
      expect(
        cached.matrix.include.map((shard: { project: string }) => shard.project)
      ).toEqual(['cloud'])
      expect(resalted.hits).toEqual([])
      expect(resalted.matrix.include).toHaveLength(2)

      writeFileSync(files.spec, readFileSync(files.spec, 'utf8') + '\n')
      const edited = JSON.parse(
        files.run({ VIDEO_CACHE_SALT: 'a', VIDEO_CACHE_INDEX: index }).stdout
      )

      expect(edited.hits).toEqual([])
    }
  )

  it('does not discover the full suite for an empty changed-file list', () => {
    const result = spawnSync('bash', [script], { encoding: 'utf8' })

    expect(result).toMatchObject({ status: 0 })
    expect(JSON.parse(result.stdout)).toEqual({
      matrix: { include: [] },
      hits: []
    })
  })

  it('fails on invalid specs instead of treating discovery errors as no tests', () => {
    using files = fixture(1)
    writeFileSync(files.spec, 'throw new Error("broken discovery")')

    const result = files.run()

    expect(result.status).not.toBe(0)
    expect(result.stdout).toBe('')
  })
})

describe('independent video workflow', () => {
  it.for([
    [
      ['first.spec.ts', 'nested/a b.spec.ts'],
      [],
      [],
      0,
      ['key0.pass', 'key0.zip', 'key1.pass', 'key1.zip']
    ],
    [
      ['first.spec.ts', 'failing.spec.ts'],
      ['failing.spec.ts'],
      [],
      1,
      ['key0.pass', 'key0.zip', 'key1.zip']
    ],
    [
      ['first.spec.ts', 'blobless.spec.ts'],
      [],
      ['blobless.spec.ts'],
      1,
      ['key0.pass', 'key0.zip']
    ]
  ] satisfies [string[], string[], string[], number, string[]][])(
    'records %j one spec at a time and marks only passing specs cacheable',
    ([files, failing, blobless, status, expectedBlobs]) => {
      const workflow = z
        .object({
          jobs: z.object({
            'playwright-video-new-tests': z.object({
              steps: z.array(
                z.object({
                  name: z.string().optional(),
                  run: z.string().optional()
                })
              )
            })
          })
        })
        .parse(
          parse(
            readFileSync('.github/workflows/ci-playwright-videos.yaml', 'utf8')
          )
        )
      const command = workflow.jobs['playwright-video-new-tests'].steps.find(
        (step) => step.name === 'Record changed tests'
      )?.run
      assert.exists(command)
      const root = mkdtempSync(join(tmpdir(), 'playwright-video-command-'))
      onTestFinished(() => rmSync(root, { recursive: true, force: true }))
      const bin = join(root, 'bin')
      mkdirSync(bin)
      symlinkSync(process.execPath, join(bin, 'node'))
      writeFileSync(
        join(bin, 'pnpm'),
        `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n')
const dir = process.env.PLAYWRIGHT_BLOB_OUTPUT_DIR
if (dir && !${JSON.stringify(blobless)}.includes(args.at(-1))) {
  const blob =
    process.env.PLAYWRIGHT_BLOB_OUTPUT_FILE ?? dir + '/report-cloud-0666423.zip'
  fs.mkdirSync(require('node:path').dirname(blob), { recursive: true })
  fs.writeFileSync(blob, 'blob')
}
process.exit(${JSON.stringify(failing)}.includes(args.at(-1)) ? 1 : 0)
`,
        { mode: 0o755 }
      )
      const specs = files.map((file, i) => ({ file, key: `key${i}` }))
      const result = spawnSync(bash, ['-eo', 'pipefail', '-c', command], {
        cwd: root,
        encoding: 'utf8',
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          PROJECT: 'cloud',
          SPECS_JSON: JSON.stringify(specs)
        }
      })

      expect(result.status).toBe(status)
      expect(
        readFileSync(join(root, 'calls.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
      ).toEqual(
        files.map((file) => [
          'exec',
          'playwright',
          'test',
          '--project=cloud',
          '--timeout=180000',
          '--retries=0',
          file
        ])
      )
      const blobs = readdirSync(join(root, 'blob-report'))
      expect(blobs).toEqual(expect.arrayContaining(expectedBlobs))
      expect(blobs).toHaveLength(expectedBlobs.length)
    }
  )

  it.for([
    [
      ['fresh.zip', 'fresh.pass'],
      0,
      ['fresh.zip', 'hit.zip'],
      ['fresh.pass', 'fresh.zip', 'hit.zip'],
      'hit\told1234\nfresh\thead567\n'
    ],
    [
      ['fresh.pass'],
      1,
      ['hit.zip'],
      ['fresh.pass', 'hit.zip'],
      'hit\told1234\n'
    ]
  ] satisfies [string[], number, string[], string[], string][])(
    'combines recordings %j with exit status %i',
    ([recorded, status, cached, blobs, index]) => {
      const workflow = z
        .object({
          jobs: z.object({
            report: z.object({
              steps: z.array(
                z.object({
                  name: z.string().optional(),
                  run: z.string().optional()
                })
              )
            })
          })
        })
        .parse(
          parse(
            readFileSync('.github/workflows/ci-playwright-videos.yaml', 'utf8')
          )
        )
      const command = workflow.jobs.report.steps.find(
        (step) => step.name === 'Combine cached and new recordings'
      )?.run
      assert.exists(command)
      const root = mkdtempSync(join(tmpdir(), 'playwright-video-combine-'))
      onTestFinished(() => rmSync(root, { recursive: true, force: true }))
      mkdirSync(join(root, 'video-blobs'))
      mkdirSync(join(root, 'previous-cache'))
      writeFileSync(join(root, 'previous-cache', 'hit.zip'), 'blob')
      spawnSync('touch', recorded, { cwd: join(root, 'video-blobs') })

      const result = spawnSync(bash, ['-eo', 'pipefail', '-c', command], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          HITS: '[{"key":"hit","sha":"old1234"}]',
          HEAD_SHA: 'head567'
        }
      })

      expect(result.status).toBe(status)
      const cache = readdirSync(join(root, 'video-cache'))
      expect(cache).toEqual(expect.arrayContaining(cached))
      expect(cache).toHaveLength(cached.length)
      const merged = readdirSync(join(root, 'video-blobs'))
      expect(merged).toEqual(expect.arrayContaining(blobs))
      expect(merged).toHaveLength(blobs.length)
      expect(readFileSync(join(root, 'video-cache-index.txt'), 'utf8')).toBe(
        index
      )
    }
  )

  it('publishes only the triggering run from a trusted checkout for a current PR', () => {
    const workflow: unknown = parse(
      readFileSync('.github/workflows/pr-playwright-videos.yaml', 'utf8')
    )

    expect(workflow).toMatchObject({
      on: {
        workflow_run: {
          workflows: ['CI: Playwright Videos'],
          types: ['completed']
        }
      },
      jobs: {
        publish: {
          if: expect.stringContaining(
            'github.event.workflow_run.head_repository.full_name == github.repository'
          ),
          steps: expect.arrayContaining([
            expect.objectContaining({
              uses: expect.stringMatching(/^actions\/checkout@/),
              with: {
                ref: '${{ github.event.repository.default_branch }}',
                'persist-credentials': false
              }
            }),
            expect.objectContaining({
              id: 'pr',
              uses: './.github/actions/resolve-pr-from-workflow-run'
            }),
            expect.objectContaining({
              uses: expect.stringMatching(/^actions\/download-artifact@/),
              if: "steps.pr.outputs.skip != 'true'",
              with: {
                name: 'playwright-report-new-tests',
                path: 'video-report',
                'github-token': '${{ github.token }}',
                repository: '${{ github.repository }}',
                'run-id': '${{ github.event.workflow_run.id }}'
              }
            }),
            expect.objectContaining({
              uses: './.github/actions/post-pr-report-comment',
              with: expect.objectContaining({
                'pr-number': '${{ steps.pr.outputs.number }}'
              })
            })
          ])
        }
      }
    })
  })
})
