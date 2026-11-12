import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { z } from 'zod'

const projects = ['cloud', 'chromium'] as const
const suiteSchema = z.object({
  suites: z.array(z.unknown()).default([]),
  specs: z
    .array(
      z.object({
        file: z.string(),
        tests: z.array(
          z.object({
            projectName: z.string(),
            results: z.array(
              z.object({
                retry: z.number().int().nonnegative(),
                duration: z.number().finite().nonnegative(),
                status: z.string()
              })
            )
          })
        )
      })
    )
    .default([])
})

export function reportTimings(report: unknown, project: string) {
  const parsed = z
    .object({
      suites: z.array(z.unknown()),
      errors: z.array(z.unknown()).length(0),
      stats: z.object({ unexpected: z.literal(0) })
    })
    .parse(report)
  const files = new Map<string, number[]>()
  function collect(value: unknown) {
    const suite = suiteSchema.parse(value)
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        if (test.projectName !== project) continue
        const result = test.results.find((result) => result.retry === 0)
        if (!result || result.status === 'skipped' || result.duration === 0)
          continue
        const durations = files.get(spec.file) ?? []
        durations.push(result.duration)
        files.set(spec.file, durations)
      }
    }
    suite.suites.forEach(collect)
  }
  parsed.suites.forEach(collect)
  return Object.fromEntries(
    [...files].map(([file, durations]) => [
      file,
      durations.reduce((total, duration) => total + duration, 0) /
        durations.length
    ])
  )
}

function main() {
  const output = z
    .string()
    .min(1)
    .parse(process.env.PLAYWRIGHT_SHARD_TIMINGS_DIR)
  const repository = z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/u)
    .parse(process.env.GITHUB_REPOSITORY)
  const directory = mkdtempSync(path.join(tmpdir(), 'playwright-timings-'))
  const baselines: Record<
    string,
    { sourceRun: number | null; millisecondsPerTest: Record<string, number> }
  > = Object.fromEntries(
    projects.map((project) => [
      project,
      { sourceRun: null, millisecondsPerTest: {} }
    ])
  )
  try {
    const response: unknown = JSON.parse(
      execFileSync(
        'gh',
        [
          'api',
          `repos/${repository}/actions/workflows/ci-tests-e2e.yaml/runs?branch=main&event=push&status=success&per_page=1`
        ],
        { encoding: 'utf8', timeout: 60_000 }
      )
    )
    const runs = z
      .object({
        workflow_runs: z.array(z.object({ id: z.number().int().positive() }))
      })
      .parse(response)
    const run = runs.workflow_runs.at(0)
    if (run) {
      for (const project of projects) {
        const target = path.join(directory, project)
        execFileSync(
          'gh',
          [
            'run',
            'download',
            String(run.id),
            '--repo',
            repository,
            '--name',
            `playwright-report-${project}`,
            '--dir',
            target
          ],
          { timeout: 120_000, stdio: ['ignore', 'ignore', 'pipe'] }
        )
        const report: unknown = JSON.parse(
          readFileSync(path.join(target, 'report.json'), 'utf8')
        )
        baselines[project] = {
          sourceRun: run.id,
          millisecondsPerTest: reportTimings(report, project)
        }
        console.log(`${project}: loaded timings from main run ${run.id}`)
      }
    } else {
      console.warn('No successful main E2E run found; using equal weights')
    }
  } catch (error) {
    console.warn(
      'Prior E2E reports unavailable; projects without timings use equal weights',
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
  mkdirSync(output, { recursive: true })
  for (const project of projects) {
    writeFileSync(
      path.join(output, `${project}.json`),
      JSON.stringify(baselines[project])
    )
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
