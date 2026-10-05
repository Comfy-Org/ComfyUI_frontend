import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const script = join(import.meta.dirname, 'plan-playwright-videos.sh')
const playwright = fileURLToPath(import.meta.resolve('@playwright/test'))

function fixture(chromiumCount: number, cloudCount = 0) {
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

  return {
    spec,
    run() {
      return spawnSync('bash', [script, '--config', config, spec], {
        encoding: 'utf8',
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: '' }
      })
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
    [50, 1],
    [51, 2],
    [801, 16]
  ] satisfies [number, number][])(
    'plans %i discovered tests into %i shards',
    ([count, shards]) => {
      using files = fixture(count)
      const result = files.run()

      expect(result).toMatchObject({ status: 0 })
      expect(JSON.parse(result.stdout)).toEqual({
        include: Array.from({ length: shards }, (_, i) => ({
          project: 'chromium',
          shardIndex: i + 1,
          shardTotal: shards
        }))
      })
    }
  )

  it('routes mixed specs through Playwright and excludes audit-only tests', () => {
    using files = fixture(51, 2)
    const result = files.run()

    expect(result).toMatchObject({ status: 0 })
    expect(JSON.parse(result.stdout)).toEqual({
      include: [
        { project: 'chromium', shardIndex: 1, shardTotal: 2 },
        { project: 'chromium', shardIndex: 2, shardTotal: 2 },
        { project: 'cloud', shardIndex: 1, shardTotal: 1 }
      ]
    })
  })

  it('does not discover the full suite for an empty changed-file list', () => {
    const result = spawnSync('bash', [script], { encoding: 'utf8' })

    expect(result).toMatchObject({ status: 0 })
    expect(JSON.parse(result.stdout)).toEqual({ include: [] })
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
      '["first.spec.ts","nested/a b.spec.ts"]',
      0,
      [
        'exec',
        'playwright',
        'test',
        '--project=cloud',
        '--shard=2/3',
        '--timeout=180000',
        '--retries=0',
        'first.spec.ts',
        'nested/a b.spec.ts'
      ]
    ],
    ['[]', 1, []],
    ['invalid json', 1, []]
  ] satisfies [string, number, string[]][])(
    'passes only selected files to Playwright without jq: %s',
    ([files, status, expectedArgs]) => {
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
      if (!command) throw new Error('Missing recording command')
      const root = mkdtempSync(join(tmpdir(), 'playwright-video-command-'))
      try {
        symlinkSync(process.execPath, join(root, 'node'))
        writeFileSync(
          join(root, 'pnpm'),
          `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv.slice(2)))\n`,
          { mode: 0o755 }
        )
        const result = spawnSync(
          '/bin/bash',
          ['-eo', 'pipefail', '-c', command],
          {
            encoding: 'utf8',
            env: {
              PATH: root,
              FILES_JSON: files,
              PROJECT: 'cloud',
              SHARD: '2/3'
            }
          }
        )

        expect(result.status).toBe(status)
        expect(JSON.parse(result.stdout || '[]')).toEqual(expectedArgs)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  )

  it('records slow-motion shards without joining the required test pipeline', () => {
    const workflow: unknown = parse(
      readFileSync('.github/workflows/ci-playwright-videos.yaml', 'utf8')
    )

    expect(workflow).toMatchObject({
      on: { pull_request: expect.any(Object) },
      permissions: { contents: 'read' },
      concurrency: { group: '${{ github.workflow }}-${{ github.ref }}' },
      defaults: { run: { shell: 'bash' } },
      jobs: {
        build: { needs: 'plan' },
        'playwright-video-new-tests': {
          needs: ['plan', 'build'],
          'timeout-minutes': 60,
          strategy: {
            'fail-fast': false,
            matrix: '${{ fromJSON(needs.plan.outputs.matrix) }}'
          },
          steps: expect.arrayContaining([
            expect.objectContaining({
              env: expect.objectContaining({
                RECORD_VIDEO: 'true',
                SLOW_MO: '250',
                PLAYWRIGHT_BLOB_OUTPUT_DIR: 'blob-report',
                SHARD: '${{ matrix.shardIndex }}/${{ matrix.shardTotal }}'
              }),
              run: expect.stringContaining('--shard="$SHARD"')
            }),
            expect.objectContaining({
              if: 'always()',
              with: expect.objectContaining({
                name: 'video-blob-${{ matrix.project }}-${{ matrix.shardIndex }}'
              })
            })
          ])
        },
        report: {
          needs: ['plan', 'playwright-video-new-tests'],
          if: "always() && needs.plan.outputs.has-tests == 'true'"
        }
      }
    })
  })

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
              if: "steps.pr.outputs.skip != 'true'",
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
