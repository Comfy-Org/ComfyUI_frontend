import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'custom-nodes-summary.py')

it('reports aggregate all-node tier results for each pack', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-nodes-summary-'))
  try {
    fs.writeFileSync(
      path.join(dir, 'custom-nodes-results.json'),
      JSON.stringify({ stats: { expected: 1, unexpected: 1 } })
    )
    fs.writeFileSync(
      path.join(dir, 'custom-nodes.log'),
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
        GITHUB_STEP_SUMMARY: path.join(dir, 'summary.md')
      }
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/^Pack-A\s+-\s+FAIL 1\/2\s+-/m)
    expect(result.stdout).toMatch(/^Pack-B\s+-\s+PASS\s+-/m)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
