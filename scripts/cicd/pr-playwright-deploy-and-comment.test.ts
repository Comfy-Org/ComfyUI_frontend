import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { expect, it } from 'vitest'

it.for([
  [
    'success',
    'success',
    'success',
    'success',
    'success',
    '✅ 12 passed, 0 failed'
  ],
  [
    'build failure',
    'failure',
    'skipped',
    'skipped',
    'success',
    '❌ E2E failure · 12 passed, 0 failed'
  ],
  [
    'merge failure',
    'success',
    'failure',
    'success',
    'success',
    '❌ E2E failure · 12 passed, 0 failed'
  ],
  [
    'cancellation',
    'failure',
    'skipped',
    'cancelled',
    'success',
    '❌ E2E cancelled · 12 passed, 0 failed'
  ],
  [
    'unrelated unit failure',
    'success',
    'success',
    'success',
    'failure',
    '✅ 12 passed, 0 failed'
  ]
])(
  'reports %s from source E2E jobs when only passing Chromium results exist',
  ([_name, summaryResult, mergeResult, testResult, unitResult, headline]) => {
    const root = mkdtempSync(join(tmpdir(), 'playwright-comment-'))
    try {
      const bin = join(root, 'bin')
      mkdirSync(bin)
      mkdirSync(join(root, 'reports/playwright-report-chromium'), {
        recursive: true
      })
      writeFileSync(
        join(bin, 'wrangler'),
        '#!/bin/sh\necho https://report.pages.dev\n',
        { mode: 0o755 }
      )
      writeFileSync(
        join(bin, 'tsx'),
        '#!/bin/sh\necho \'{"passed":12,"failed":0,"flaky":0,"skipped":0,"total":12}\'\n',
        { mode: 0o755 }
      )
      const jobsFile = join(root, 'jobs.json')
      writeFileSync(
        jobsFile,
        JSON.stringify([
          {
            jobs: [
              { name: 'e2e-status', conclusion: summaryResult },
              {
                name: 'playwright-tests-chromium-sharded (1, 16)',
                conclusion: testResult
              },
              { name: 'unit / test', conclusion: unitResult }
            ]
          },
          {
            jobs: [
              { name: 'merge-reports (chromium)', conclusion: mergeResult },
              { name: 'merge-reports (cloud)', conclusion: mergeResult }
            ]
          }
        ])
      )
      writeFileSync(join(bin, 'gh'), '#!/bin/sh\ncat "$JOBS_FILE"\n', {
        mode: 0o755
      })
      const summary = join(root, 'summary.md')
      const execution = spawnSync(
        'bash',
        [
          resolve('scripts/cicd/pr-playwright-deploy-and-comment.sh'),
          '20528',
          'branch',
          'completed'
        ],
        {
          cwd: root,
          encoding: 'utf8',
          env: {
            PATH: `${bin}:${process.env.PATH}`,
            GITHUB_TOKEN: 'test-token',
            GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
            CLOUDFLARE_API_TOKEN: 'test-token',
            CLOUDFLARE_ACCOUNT_ID: 'test-account',
            SUMMARY_FILE: summary,
            SOURCE_RUN_ID: '123',
            JOBS_FILE: jobsFile
          }
        }
      )
      expect(execution).toMatchObject({ status: 0 })
      expect(readFileSync(summary, 'utf8')).toContain(
        `## 🎭 Playwright: ${headline}`
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
)
