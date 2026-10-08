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
  ['success', '✅ 12 passed, 0 failed'],
  ['failure', '❌ Workflow failure · 12 passed, 0 failed'],
  ['cancelled', '❌ Workflow cancelled · 12 passed, 0 failed']
])(
  'reports %s even when only passing Chromium results exist',
  ([result, headline]) => {
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
            WORKFLOW_RESULT: result
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
