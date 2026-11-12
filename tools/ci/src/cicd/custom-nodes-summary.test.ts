import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const SCRIPT = path.join(import.meta.dirname, 'custom-nodes-summary.py')

it.for(['scripts/cicd', 'tools/ci/src/cicd'])(
  'reports each pack and tier when the selected ref stores scripts in %s',
  (scriptDirectory) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-nodes-summary-'))
    try {
      fs.mkdirSync(path.join(dir, scriptDirectory), { recursive: true })
      fs.copyFileSync(
        SCRIPT,
        path.join(dir, scriptDirectory, 'custom-nodes-summary.py')
      )
      execFileSync('git', ['init', '-q'], { cwd: dir })
      execFileSync('git', ['add', scriptDirectory], { cwd: dir })
      const workflow = z
        .object({
          jobs: z.record(
            z.string(),
            z.object({
              steps: z
                .array(
                  z.object({
                    name: z.string().optional(),
                    run: z.string().optional()
                  })
                )
                .optional()
            })
          )
        })
        .parse(
          parse(
            fs.readFileSync(
              '.github/workflows/ci-tests-custom-nodes.yaml',
              'utf8'
            )
          )
        )
      const command = z.string().parse(
        Object.values(workflow.jobs)
          .flatMap((job) => job.steps ?? [])
          .find((step) => step.name === 'Publish results table')?.run
      )
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
          '[tier-pack] tier=S2 pack=Pack-B result=pass',
          'Pack-B: ExampleNode excluded from auto-run (requires a model)'
        ].join('\n')
      )

      const result = spawnSync(
        'bash',
        ['-e', '-o', 'pipefail', '-c', command],
        {
          cwd: dir,
          encoding: 'utf8',
          env: {
            ...process.env,
            CUSTOM_NODES_MANIFEST: 'cloud',
            GITHUB_STEP_SUMMARY: path.join(dir, 'summary.md')
          }
        }
      )

      expect(result.status).toBe(0)
      const summary = fs.readFileSync(path.join(dir, 'summary.md'), 'utf8')
      expect(summary).toContain('## Custom-node Cloud breadth suite')
      expect(summary).toContain('| Pack | startup/load | S1 | S2 | S3 | S9 |')
      expect(summary).toContain('### S9 node execution skips')
      expect(summary).toContain(
        '**S9 - SKIP - NODE NOT EXECUTED - Pack-B / ExampleNode**'
      )
      expect(summary).toContain(
        'this is node-level execution coverage debt, not a whole-pack skip'
      )
      expect(summary).toContain(
        "`not enrolled` this pack's manifest row does not declare this tier"
      )
      expect(result.stdout).toMatch(
        /^Pack-A\s+not enrolled\s+PASS\s+FAIL 1\/1\s+not enrolled/m
      )
      expect(result.stdout).toMatch(
        /^Pack-B\s+not enrolled\s+PASS\s+PASS\s+not enrolled/m
      )
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
)

it('labels an isolated all-node failure with its S-tier', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-nodes-summary-'))
  try {
    fs.writeFileSync(
      path.join(dir, 'custom-nodes-results.json'),
      JSON.stringify({
        stats: { expected: 0, unexpected: 1 },
        suites: [
          {
            file: 'browser_tests/tests/customNodes/allNodes.spec.ts',
            title: 'all nodes by tier @custom-nodes',
            specs: [
              {
                title: 'S3: every registered node survives save and reload',
                tests: [{ status: 'unexpected', results: [] }]
              }
            ]
          }
        ]
      })
    )
    fs.writeFileSync(path.join(dir, 'custom-nodes.log'), '')

    const result = spawnSync('python3', [SCRIPT], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: path.join(dir, 'summary.md')
      }
    })

    expect(result.status).toBe(0)
    const summary = fs.readFileSync(path.join(dir, 'summary.md'), 'utf8')
    expect(summary).toContain('- **S3**: FAIL 1/1')
    expect(summary).not.toContain('- **manifest coverage**: FAIL 1/1')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
