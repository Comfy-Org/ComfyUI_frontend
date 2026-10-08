import { readFileSync } from 'node:fs'

import type { Reporter, Suite } from '@playwright/test/reporter'
import { isEqual } from 'es-toolkit'
import { z } from 'zod'

const zSpec = z.object({
  title: z.string(),
  file: z.string(),
  tests: z.array(
    z.object({ results: z.array(z.object({ duration: z.number() })) })
  )
})

interface ReportSuite {
  title: string
  specs?: z.infer<typeof zSpec>[]
  suites?: ReportSuite[]
}

const zSuite: z.ZodType<ReportSuite> = z.lazy(() =>
  z.object({
    title: z.string(),
    specs: z.array(zSpec).optional(),
    suites: z.array(zSuite).optional()
  })
)

const zReport = z.object({ suites: z.array(zSuite) })

export interface SpecFile {
  file: string
  tests: string[]
}

export interface Shard {
  files: string[]
  duration: number
}

type PreprocessParams = Parameters<NonNullable<Reporter['preprocess']>>[0]

function titlePath(titles: string[]): string {
  return titles.join(' › ')
}

/**
 * Keyed by title path. Only the final attempt counts: a retry in one run says
 * little about the next.
 */
export function testDurations(report: unknown): Map<string, number> {
  const durations = new Map<string, number>()
  const visit = (suite: ReportSuite, titles: string[]) => {
    for (const spec of suite.specs ?? [])
      for (const { results } of spec.tests) {
        const final = results.at(-1)
        if (final)
          durations.set(
            titlePath([spec.file, ...titles, spec.title]),
            final.duration
          )
      }
    for (const child of suite.suites ?? [])
      visit(child, child.title ? [...titles, child.title] : titles)
  }
  for (const file of zReport.parse(report).suites) visit(file, [])
  return durations
}

function median(values: number[]): number | undefined {
  const sorted = values.toSorted((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[middle]
  if (sorted.length) return (sorted[middle - 1] + sorted[middle]) / 2
  return undefined
}

/**
 * Greedy longest-first packing of whole spec files, so tests that must share
 * a worker stay together. Tests missing from `durations` cost the median.
 */
export function planShards(
  files: SpecFile[],
  durations: Map<string, number>,
  total: number
): Shard[] {
  const fallback = median([...durations.values()]) ?? 1
  const estimates = files.map(({ file, tests }) => ({
    file,
    duration: tests.reduce(
      (sum, test) => sum + (durations.get(test) ?? fallback),
      0
    )
  }))
  const longestFirst = estimates.toSorted(
    (a, b) => b.duration - a.duration || (a.file < b.file ? -1 : 1)
  )
  const shards = Array.from(
    { length: total },
    (): Shard => ({
      files: [],
      duration: 0
    })
  )
  for (const { file, duration } of longestFirst) {
    const lightest = shards.reduce((min, shard) =>
      shard.duration < min.duration ? shard : min
    )
    lightest.files.push(file)
    lightest.duration += duration
  }

  const planned = shards.flatMap((shard) => shard.files).sort()
  if (!isEqual(planned, files.map(({ file }) => file).sort()))
    throw new Error('Duration shards must cover each spec file exactly once')
  return shards
}

function specFiles(fileSuites: Suite[]): SpecFile[] {
  const files = new Map<string, string[]>()
  for (const fileSuite of fileSuites)
    files.set(fileSuite.title, [
      ...(files.get(fileSuite.title) ?? []),
      ...fileSuite
        .allTests()
        .map((test) => titlePath(test.titlePath().slice(2)))
    ])
  return [...files].map(([file, tests]) => ({ file, tests }))
}

function seconds(milliseconds: number): string {
  return `${Math.round(milliseconds / 1000)}s`
}

/**
 * Replaces Playwright's equal-count `--shard` split with one balanced by the
 * test durations in a previous JSON report. Without that report it does
 * nothing, and the built-in split applies.
 */
export default class DurationShardReporter implements Reporter {
  private readonly durations?: string

  constructor({ durations }: { durations?: string } = {}) {
    this.durations = durations
  }

  printsToStdio() {
    return false
  }

  async preprocess({ config, suite, testRun }: PreprocessParams) {
    if (!this.durations || !config.shard) return

    const fileSuites = suite.suites.flatMap((project) => project.suites)
    const files = specFiles(fileSuites)
    const durations = testDurations(
      JSON.parse(readFileSync(this.durations, 'utf8'))
    )
    const shards = planShards(files, durations, config.shard.total)
    const mine = shards[config.shard.current - 1]
    const owned = new Set(mine.files)

    testRun.skipSharding()
    for (const fileSuite of fileSuites)
      if (!owned.has(fileSuite.title)) testRun.exclude(fileSuite)

    const tests = files.flatMap((file) => file.tests)
    const unknown = tests.filter((test) => !durations.has(test)).length
    const loads = shards.map((shard) => shard.duration)
    process.stdout.write(
      `Shard ${config.shard.current}/${config.shard.total} by duration: ` +
        `${suite.allTests().length} tests in ${mine.files.length} files, ` +
        `estimated ${seconds(mine.duration)} (all shards ` +
        `${seconds(Math.min(...loads))}-${seconds(Math.max(...loads))}; ` +
        `${unknown} of ${tests.length} tests had no previous duration)\n`
    )
  }
}
