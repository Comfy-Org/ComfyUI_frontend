import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const script = join(import.meta.dirname, 'pr-playwright-deploy-and-comment.sh')

const e2eWorkflow = z
  .object({
    jobs: z.object({
      'merge-reports': z.object({
        strategy: z.object({
          matrix: z.object({ project: z.array(z.string()) })
        })
      }),
      'playwright-tests': z.object({
        strategy: z.object({
          matrix: z.object({
            include: z.array(z.object({ browser: z.string() }))
          })
        })
      })
    })
  })
  .parse(parse(readFileSync('.github/workflows/ci-tests-e2e.yaml', 'utf8')))

const uploadedProjects = [
  ...e2eWorkflow.jobs['merge-reports'].strategy.matrix.project,
  ...e2eWorkflow.jobs['playwright-tests'].strategy.matrix.include.map(
    ({ browser }) => browser
  )
]

const passingCounts = { passed: 2, failed: 0, flaky: 0, skipped: 0, total: 2 }

function runWithReports(
  projects: string[],
  countsByProject: Record<string, object> = {}
) {
  const root = mkdtempSync(join(tmpdir(), 'playwright-pr-report-'))
  const bin = join(root, 'bin')
  const wranglerLog = join(root, 'wrangler.log')
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(bin)
  writeFileSync(
    join(bin, 'wrangler'),
    `#!/bin/bash
echo "$*" >> "${wranglerLog}"
project=$(printf '%s\\n' "$@" | sed -n 's/^--project-name=//p')
echo "https://abc.$project.pages.dev"
`
  )
  writeFileSync(
    join(bin, 'tsx'),
    `#!/bin/bash
cat "$2/counts.json"
`
  )
  chmodSync(join(bin, 'wrangler'), 0o755)
  chmodSync(join(bin, 'tsx'), 0o755)
  for (const project of projects) {
    const reportDir = join(root, 'reports', `playwright-report-${project}`)
    mkdirSync(reportDir, { recursive: true })
    writeFileSync(
      join(reportDir, 'counts.json'),
      JSON.stringify(countsByProject[project] ?? passingCounts)
    )
  }

  const result = spawnSync('bash', [script, '1', 'feature', 'completed'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_TOKEN: 'token',
      GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
      GITHUB_SHA: 'sha',
      CLOUDFLARE_API_TOKEN: 'token',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      SUMMARY_FILE: join(root, 'summary.md')
    }
  })
  return {
    status: result.status,
    summary: readFileSync(join(root, 'summary.md'), 'utf8'),
    wranglerCalls: readFileSync(wranglerLog, 'utf8')
  }
}

describe('PR Playwright report section', () => {
  it('reports every project the E2E workflow uploads and ignores unknown artifacts', () => {
    const { status, summary, wranglerCalls } = runWithReports([
      ...uploadedProjects,
      'untrusted'
    ])

    expect(status).toBe(0)
    expect(summary).toMatch(/^## 🎭 Playwright: ✅ /)
    const reportedProjects = Array.from(
      summary.matchAll(/^- \*\*(.+)\*\*: \[View Report\]/gm),
      ([, project]) => project
    )
    expect(reportedProjects).toEqual(expect.arrayContaining(uploadedProjects))
    expect(reportedProjects).toHaveLength(uploadedProjects.length)
    expect(summary).not.toContain('untrusted')
    expect(wranglerCalls).not.toContain('untrusted')
  })

  it('fails the headline and lists a project whose report never arrived', () => {
    const { status, summary } = runWithReports(
      uploadedProjects.filter((project) => project !== 'cloud')
    )

    expect(status).toBe(0)
    expect(summary).toMatch(/^## 🎭 Playwright: ❌ .*, 1 missing/)
    expect(summary).toContain('- **cloud**: ❌ Report missing')
  })

  it('lists each named failed test with its trace in a collapsed box', () => {
    const { status, summary } = runWithReports(uploadedProjects, {
      chromium: {
        passed: 1,
        failed: 1,
        flaky: 0,
        skipped: 0,
        total: 2,
        failures: [
          {
            name: 'saves a workflow',
            file: 'browser_tests/tests/save.spec.ts',
            traceUrl: 'https://abc.chromium.pages.dev/trace/1'
          }
        ]
      }
    })

    expect(status).toBe(0)
    expect(summary).toMatch(/^## 🎭 Playwright: ❌ .*, 1 failed/)
    expect(summary).toContain(
      `> ❌ 1 test failed. Expand the failed tests below, review their traces and fix the failures before merging.

<details>
<summary>❌ Failed Tests</summary>

- [saves a workflow](https://github.com/Comfy-Org/ComfyUI_frontend/blob/sha/browser_tests/tests/save.spec.ts): [View trace](https://abc.chromium.pages.dev/trace/1)

</details>`
    )
  })

  it('points to the browser reports when failed tests have no extracted names', () => {
    const { status, summary } = runWithReports(uploadedProjects, {
      chromium: { passed: 1, failed: 1, flaky: 0, skipped: 0, total: 2 }
    })

    expect(status).toBe(0)
    expect(summary).toMatch(/^## 🎭 Playwright: ❌ .*, 1 failed/)
    expect(summary).toContain(
      '> ❌ 1 test failed. Open the browser reports below, review the traces and fix the failures before merging.'
    )
    expect(summary).not.toContain('Failed Tests')
  })
})
