import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult
} from '@playwright/test/reporter'

import type {
  ProjectData,
  RecordedTest,
  Renderer
} from '@e2e/reporters/nodes2Acceptance/report'
import {
  isAcceptanceProject,
  orderedSections,
  renderReport,
  summariseError
} from '@e2e/reporters/nodes2Acceptance/report'

const OUTPUT_DIR =
  process.env.NODES2_ACCEPTANCE_REPORT_DIR ?? 'nodes2-acceptance-report'

function currentCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 10)
  try {
    return execSync('git rev-parse --short=10 HEAD', {
      encoding: 'utf8'
    }).trim()
  } catch {
    return 'unknown'
  }
}

function rendererOf(tags: string[], describe: string): Renderer {
  if (tags.includes('@vue-nodes')) return 'nodes2'
  return /(: | on )classic\b/.test(describe) ? 'classic' : 'both'
}

function perfMeasurements(test: TestCase, result: TestResult): string[] {
  return [...test.annotations, ...result.annotations].flatMap((annotation) =>
    annotation.type === 'perf' && annotation.description
      ? [annotation.description]
      : []
  )
}

function record(test: TestCase, result: TestResult): RecordedTest {
  const [, , file, ...rest] = test.titlePath()
  const describe = rest.slice(0, -1).join(' › ')
  return {
    file: path.basename(file),
    describe,
    title: test.title,
    renderer: rendererOf(test.tags, describe),
    status: result.status,
    error: summariseError(result.error?.message ?? ''),
    measurements: perfMeasurements(test, result)
  }
}

function readAllProjectData(): ProjectData[] {
  const dataDir = path.join(OUTPUT_DIR, 'data')
  if (!fs.existsSync(dataDir)) return []
  return fs
    .readdirSync(dataDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) =>
      JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))
    )
}

function writeProjectData(
  byProject: Map<string, RecordedTest[]>,
  commit: string,
  finishedAt: string
) {
  fs.mkdirSync(path.join(OUTPUT_DIR, 'data'), { recursive: true })
  for (const [project, tests] of byProject) {
    const data: ProjectData = { project, commit, finishedAt, tests }
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'data', `${project}.json`),
      JSON.stringify(data, null, 2)
    )
  }
}

function writeReport(finishedAt: string) {
  const all = readAllProjectData()
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'report.html'),
    renderReport(
      orderedSections(all),
      all.map((data) => data.commit).filter(Boolean),
      `${finishedAt.slice(0, 16).replace('T', ' ')} UTC`
    )
  )
}

/** Writes per-project acceptance data and a combined HTML report to `nodes2-acceptance-report/`. */
export default class Nodes2AcceptanceReporter implements Reporter {
  private readonly finalResults = new Map<TestCase, TestResult>()

  onTestEnd(test: TestCase, result: TestResult) {
    if (isAcceptanceProject(test.parent.project()?.name ?? ''))
      this.finalResults.set(test, result)
  }

  onEnd(result: FullResult) {
    if (this.finalResults.size === 0 || result.status === 'interrupted') return
    const finishedAt = new Date().toISOString()
    writeProjectData(this.groupByProject(), currentCommit(), finishedAt)
    writeReport(finishedAt)
  }

  private groupByProject() {
    const byProject = new Map<string, RecordedTest[]>()
    for (const [test, testResult] of this.finalResults) {
      const project = test.parent.project()!.name
      byProject.set(project, [
        ...(byProject.get(project) ?? []),
        record(test, testResult)
      ])
    }
    return byProject
  }
}
