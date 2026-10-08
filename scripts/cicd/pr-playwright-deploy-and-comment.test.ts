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
  { name: 'success', headline: '✅ 12 passed, 0 failed' },
  {
    name: 'build failure',
    summaryResult: 'failure',
    mergeResult: 'skipped',
    testResult: 'skipped',
    headline: '❌ E2E failure · 12 passed, 0 failed'
  },
  {
    name: 'merge failure',
    mergeResult: 'failure',
    headline: '❌ E2E failure · 12 passed, 0 failed'
  },
  {
    name: 'cancellation',
    summaryResult: 'failure',
    mergeResult: 'skipped',
    testResult: 'cancelled',
    headline: '❌ E2E cancelled · 12 passed, 0 failed'
  },
  {
    name: 'unrelated unit failure',
    unitResult: 'failure',
    headline: '✅ 12 passed, 0 failed'
  },
  {
    name: 'API failure',
    apiExitCode: 1,
    headline: '⚠️ E2E unknown · 12 passed, 0 failed'
  },
  {
    name: 'test failure',
    summaryResult: 'failure',
    testResult: 'failure',
    failed: 3,
    headline: '❌ 12 passed, 3 failed'
  }
])(
  'reports $name from source E2E jobs',
  ({
    summaryResult = 'success',
    mergeResult = 'success',
    testResult = 'success',
    unitResult = 'success',
    apiExitCode = 0,
    failed = 0,
    headline
  }) => {
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
      const countsFile = join(root, 'counts.json')
      writeFileSync(
        countsFile,
        JSON.stringify({
          passed: 12,
          failed,
          flaky: 0,
          skipped: 0,
          total: 12 + failed
        })
      )
      writeFileSync(join(bin, 'tsx'), '#!/bin/sh\ncat "$COUNTS_FILE"\n', {
        mode: 0o755
      })
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
      writeFileSync(
        join(bin, 'gh'),
        '#!/bin/sh\ncat "$JOBS_FILE"\nexit "$API_EXIT_CODE"\n',
        {
          mode: 0o755
        }
      )
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
            JOBS_FILE: jobsFile,
            COUNTS_FILE: countsFile,
            API_EXIT_CODE: String(apiExitCode)
          }
        }
      )
      expect(execution).toMatchObject({ status: 0 })
      const markdown = readFileSync(summary, 'utf8')
      expect(markdown).toContain(`## 🎭 Playwright: ${headline}`)
      expect(markdown.includes('Counted reports:')).toBe(
        headline.includes('E2E ')
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
)

it('requires the source run for completed reports', () => {
  const execution = spawnSync(
    'bash',
    [
      resolve('scripts/cicd/pr-playwright-deploy-and-comment.sh'),
      '20528',
      'branch',
      'completed'
    ],
    {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        GITHUB_TOKEN: 'test-token',
        GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
        CLOUDFLARE_API_TOKEN: 'test-token',
        CLOUDFLARE_ACCOUNT_ID: 'test-account'
      }
    }
  )
  expect(execution.status).toBe(1)
  expect(execution.stderr).toContain('SOURCE_RUN_ID is required')
})
