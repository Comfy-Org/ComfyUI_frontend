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

type CollectedTest = Pick<TestCase, 'id'> & { file: string; group?: string }

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

  const groups = new Map<string, CollectedTest[]>()
  for (const test of tests) {
    assert(
      test.file.trim() === test.file &&
        !/[\r\n>›:]/u.test(test.file) &&
        !test.file.startsWith('['),
      `File cannot be represented in a Playwright test list: ${test.file}`
    )
    const group = test.group ?? test.file
    const groupTests = groups.get(group) ?? []
    groupTests.push(test)
    groups.set(group, groupTests)
  }
  assert(groups.size >= shardCount, 'Each shard must contain a collected group')
  const weightedGroups = [...groups].map(([id, groupTests]) => ({
    id,
    tests: groupTests,
    estimatedMs: groupTests.reduce(
      (total, test) => total + (timings[test.file] ?? fallback),
      0
    )
  }))
  weightedGroups.sort(
    (a, b) =>
      b.estimatedMs - a.estimatedMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )

  const shards: { files: string[]; testIds: string[]; estimatedMs: number }[] =
    Array.from({ length: shardCount }, () => ({
      files: [],
      testIds: [],
      estimatedMs: 0
    }))
  for (const group of weightedGroups) {
    const shard = shards.reduce((least, candidate) =>
      candidate.estimatedMs < least.estimatedMs ? candidate : least
    )
    shard.files.push(...group.tests.map((test) => test.file))
    shard.testIds.push(...group.tests.map((test) => test.id))
    shard.estimatedMs += group.estimatedMs
  }
  assert.deepEqual(
    shards.flatMap((shard) => shard.testIds).sort(),
    tests.map((test) => test.id).sort(),
    'Shards must cover every collected test exactly once'
  )
  return shards.map((shard) => ({
    ...shard,
    files: [...new Set(shard.files)].sort()
  }))
}

function executionGroup(test: TestCase) {
  let sequential: Suite | undefined
  let parallel = false
  let file: Suite | undefined
  for (
    let suite: Suite | undefined = test.parent;
    suite;
    suite = suite.parent
  ) {
    if (suite.type === 'file') file = suite
    const mode = z
      .enum(['none', 'default', 'serial', 'parallel'])
      .parse('_parallelMode' in suite ? suite._parallelMode : undefined)
    if (mode === 'serial' || mode === 'default') sequential = suite
    if (mode === 'parallel') parallel = true
  }
  return parallel ? (sequential ?? test) : file
}

function collectGroups(config: FullConfig, tests: TestCase[], project: string) {
  const groups = new Map<Suite | TestCase | undefined, string>()
  const collected = tests.map((test) => {
    const group = executionGroup(test)
    if (!groups.has(group)) groups.set(group, test.id)
    const file = path
      .relative(config.rootDir, test.location.file)
      .split(path.sep)
      .join('/')
    const titles = test.titlePath().slice(3)
    assert(
      titles.every(
        (title) => title.trim() === title && !/[\r\n›]/u.test(title)
      ),
      `Test title cannot be represented in a Playwright test list: ${test.title}`
    )
    return {
      id: test.id,
      group: groups.get(group),
      file,
      selector: `[${project}] › ${file} › ${titles.join(' › ')}`
    }
  })
  const selectors = new Set(collected.map((test) => test.selector))
  assert.equal(selectors.size, tests.length)
  for (const selector of selectors) {
    const tokens = selector.split(' › ')
    for (let length = 2; length < tokens.length; length++) {
      const prefix = tokens.slice(0, length).join(' › ')
      assert(
        !selectors.has(prefix),
        `Ambiguous Playwright test list selector: ${prefix}`
      )
    }
  }
  return collected
}

function saltTimings(
  tests: TestCase[],
  collected: CollectedTest[],
  millisecondsPerTest: Record<string, number>,
  project: string
) {
  const samples = Object.values(millisecondsPerTest).sort((a, b) => a - b)
  const fallback = samples[Math.floor(samples.length / 2)]
  return {
    environments: [{ name: project }],
    suites: tests.map((test, index) =>
      test
        .titlePath()
        .slice(2, -1)
        .reduceRight<unknown>(
          (child, title, index, titles) => ({
            title,
            ...(index === titles.length - 1
              ? { tests: [child] }
              : { suites: [child] })
          }),
          {
            title: test.title,
            attempts: [
              {
                duration: millisecondsPerTest[collected[index].file] ?? fallback
              }
            ]
          }
        )
    )
  }
}

export default class ShardPlanner implements Reporter {
  private collection?: { config: FullConfig; suite: Suite }

  async preprocess({ config, suite }: { config: FullConfig; suite: Suite }) {
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
      assert(
        config.projects.every(
          (candidate) => !candidate.dependencies.length && !candidate.teardown
        ),
        'Group balancing requires projects without dependencies or teardown'
      )
      const baseline = baselines[project]
      assert.equal(baseline.project, project)
      const directory = z
        .string()
        .min(1)
        .parse(process.env.PLAYWRIGHT_SHARD_PLAN_DIR)
      const collected = collectGroups(config, tests, project)
      const selectors = new Map(
        collected.map((test) => [test.id, test.selector])
      )
      const shards = planShards(
        collected,
        baseline.millisecondsPerTest,
        Number(process.env.PLAYWRIGHT_SHARD_TOTAL)
      )
      mkdirSync(directory, { recursive: true })
      shards.forEach((shard, index) => {
        writeFileSync(
          path.join(directory, `${index + 1}.txt`),
          shard.testIds.map((id) => `${selectors.get(id)}\n`).join('')
        )
        console.log(
          `Shard ${index + 1}: ${shard.files.length} files, ${shard.testIds.length} tests, estimated ${(shard.estimatedMs / 1000).toFixed(1)} worker-seconds`
        )
      })
      writeFileSync(
        path.join(directory, 'plan.json'),
        JSON.stringify(shards, null, 2)
      )
      writeFileSync(
        path.join(directory, 'salt-timings.json'),
        JSON.stringify(
          saltTimings(tests, collected, baseline.millisecondsPerTest, project)
        )
      )
      return { status: 'passed' }
    } catch (error) {
      console.error(error)
      return { status: 'failed' }
    }
  }
}
