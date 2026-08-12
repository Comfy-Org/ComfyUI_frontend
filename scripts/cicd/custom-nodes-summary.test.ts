import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'custom-nodes-summary.py')

it.for([
  {
    name: 'Core',
    title: 'Custom-node core suite',
    resultFile: 'custom-nodes-results.json',
    logFile: 'custom-nodes.log',
    env: {}
  },
  {
    name: 'Cloud',
    title: 'Custom-node Cloud suite',
    resultFile: 'custom-nodes-cloud-results.json',
    logFile: 'custom-nodes-cloud.log',
    env: {
      CUSTOM_NODES_RESULTS_FILE: 'custom-nodes-cloud-results.json',
      CUSTOM_NODES_LOG_FILE: 'custom-nodes-cloud.log',
      CUSTOM_NODES_SUMMARY_TITLE: 'Custom-node Cloud suite'
    }
  }
])(
  '$name reports each all-node tier result separately for each pack',
  ({ resultFile, logFile, title, env }) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-nodes-summary-'))
    try {
      fs.writeFileSync(
        path.join(dir, resultFile),
        JSON.stringify({ stats: { expected: 1, unexpected: 1 } })
      )
      fs.writeFileSync(
        path.join(dir, logFile),
        [
          '[tier-pack] tier=S1 pack=Pack-A result=pass',
          '[tier-pack] tier=S2 pack=Pack-A result=fail',
          '[tier-pack] tier=S1 pack=Pack-B result=pass',
          '[tier-pack] tier=S2 pack=Pack-B result=pass'
        ].join('\n')
      )

      const result = spawnSync('python3', [SCRIPT], {
        cwd: dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_STEP_SUMMARY: path.join(dir, 'summary.md'),
          ...env
        }
      })

      expect(result.status).toBe(0)
      const summary = fs.readFileSync(path.join(dir, 'summary.md'), 'utf8')
      expect(summary).toContain(`## ${title}`)
      expect(summary).toContain(
        '| Pack | startup/load | S1 | S2 | S3 | S9 | S14 |'
      )
      expect(result.stdout).toMatch(/^Pack-A\s+-\s+PASS\s+FAIL 1\/1\s+-/m)
      expect(result.stdout).toMatch(/^Pack-B\s+-\s+PASS\s+PASS\s+-/m)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
)
