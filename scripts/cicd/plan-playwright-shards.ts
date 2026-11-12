import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase
} from '@playwright/test/reporter'
import { z } from 'zod'

import chromiumBaseline from './chromium-shard-timings.json' with { type: 'json' }
import cloudBaseline from './cloud-shard-timings.json' with { type: 'json' }

const baselines = { chromium: chromiumBaseline, cloud: cloudBaseline }

type CollectedTest = Pick<TestCase, 'id'> & { file: string }

export function planShards(
  tests: CollectedTest[],
  millisecondsPerTest: Record<string, number>,
  shardCount: number
) {
  const timings = z
    .record(z.string(), z.number().finite().positive())
    .parse(millisecondsPerTest)
  z.number().int().positive().parse(shardCount)
  const samples = Object.values(timings).sort((a, b) => a - b)
  assert(samples.length > 0, 'Timing baseline must not be empty')
  const fallback = samples[Math.floor(samples.length / 2)]
  assert.equal(new Set(tests.map((test) => test.id)).size, tests.length)

  const files = new Map<string, CollectedTest[]>()
  for (const test of tests) {
    assert(
      test.file.trim() === test.file &&
        !/[\r\n>›:]/u.test(test.file) &&
        !test.file.startsWith('['),
      `File cannot be represented in a Playwright test list: ${test.file}`
    )
    const fileTests = files.get(test.file) ?? []
    fileTests.push(test)
    files.set(test.file, fileTests)
  }
  assert(files.size >= shardCount, 'Each shard must contain a collected file')
  const weightedFiles = [...files].map(([file, fileTests]) => ({
    file,
    tests: fileTests,
    estimatedMs: fileTests.length * (timings[file] ?? fallback)
  }))
  weightedFiles.sort(
    (a, b) =>
      b.estimatedMs - a.estimatedMs ||
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
  )

  const shards: { files: string[]; testIds: string[]; estimatedMs: number }[] =
    Array.from({ length: shardCount }, () => ({
      files: [],
      testIds: [],
      estimatedMs: 0
    }))
  for (const file of weightedFiles) {
    const shard = shards.reduce((least, candidate) =>
      candidate.estimatedMs < least.estimatedMs ? candidate : least
    )
    shard.files.push(file.file)
    shard.testIds.push(...file.tests.map((test) => test.id))
    shard.estimatedMs += file.estimatedMs
  }
  assert.deepEqual(
    shards.flatMap((shard) => shard.testIds).sort(),
    tests.map((test) => test.id).sort(),
    'Shards must cover every collected test exactly once'
  )
  return shards.map((shard) => ({ ...shard, files: shard.files.sort() }))
}

export default class ShardPlanner implements Reporter {
  private collection?: { config: FullConfig; suite: Suite }

  onBegin(config: FullConfig, suite: Suite) {
    this.collection = { config, suite }
  }

  async onEnd(result: FullResult): Promise<{ status: FullResult['status'] }> {
    if (result.status !== 'passed') return { status: result.status }
    try {
      assert(this.collection, 'Playwright did not collect tests')
      const { config, suite } = this.collection
      assert(!config.shard, 'Collect the full project without --shard')
      const tests = suite.allTests()
      const projects = [
        ...new Set(tests.map((test) => test.parent.project()?.name))
      ]
      assert.equal(projects.length, 1, 'Collect exactly one project')
      const project = z.enum(['cloud', 'chromium']).parse(projects[0])
      const baseline = baselines[project]
      assert.equal(baseline.project, project)
      const directory = z
        .string()
        .min(1)
        .parse(process.env.PLAYWRIGHT_SHARD_PLAN_DIR)
      const shards = planShards(
        tests.map((test) => ({
          id: test.id,
          file: path
            .relative(config.rootDir, test.location.file)
            .split(path.sep)
            .join('/')
        })),
        baseline.millisecondsPerTest,
        Number(process.env.PLAYWRIGHT_SHARD_TOTAL)
      )
      mkdirSync(directory, { recursive: true })
      shards.forEach((shard, index) => {
        writeFileSync(
          path.join(directory, `${index + 1}.txt`),
          shard.files
            .map((file) => `[${baseline.project}] › ${file}\n`)
            .join('')
        )
        console.log(
          `Shard ${index + 1}: ${shard.files.length} files, ${shard.testIds.length} tests, estimated ${(shard.estimatedMs / 1000).toFixed(1)} worker-seconds`
        )
      })
      writeFileSync(
        path.join(directory, 'plan.json'),
        JSON.stringify(shards, null, 2)
      )
      return { status: 'passed' }
    } catch (error) {
      console.error(error)
      return { status: 'failed' }
    }
  }
}
