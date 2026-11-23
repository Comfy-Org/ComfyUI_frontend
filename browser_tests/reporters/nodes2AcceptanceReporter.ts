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
import type { LayoutData } from '@e2e/reporters/nodes2Acceptance/layout'
import { renderLayoutGallery } from '@e2e/reporters/nodes2Acceptance/layout'
import {
  isAcceptanceProject,
  orderedSections,
  renderReport,
  summariseError
} from '@e2e/reporters/nodes2Acceptance/report'
import {
  REPORT_DIR as OUTPUT_DIR,
  REPORT_ROOT
} from '@e2e/reporters/nodes2Acceptance/reportDir'
import type {
  RunEntry,
  RunPage
} from '@e2e/reporters/nodes2Acceptance/runIndex'
import { renderRunIndex } from '@e2e/reporters/nodes2Acceptance/runIndex'

function currentCommit() {
  if (process.env.NODES2_ACCEPTANCE_BUILD)
    return process.env.NODES2_ACCEPTANCE_BUILD
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

function readJsonFiles<T>(dataDir: string): T[] {
  if (!fs.existsSync(dataDir)) return []
  return fs
    .readdirSync(dataDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) =>
      JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))
    )
}

const readAllProjectData = () =>
  readJsonFiles<ProjectData>(path.join(OUTPUT_DIR, 'data'))

function writeLayoutGallery() {
  const layout = readJsonFiles<LayoutData>(
    path.join(OUTPUT_DIR, 'layout', 'data')
  )
  if (layout.length === 0) return false
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'layout.html'),
    renderLayoutGallery(layout)
  )
  return true
}

const subfolders = (folder: string) =>
  fs.existsSync(folder)
    ? fs
        .readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : []

function buildsIn(folder: string) {
  const commits = [
    ...readJsonFiles<{ commit?: string }>(path.join(folder, 'data')),
    ...readJsonFiles<{ commit?: string }>(path.join(folder, 'layout', 'data'))
  ].flatMap((data) => (data.commit ? [data.commit] : []))
  return [...new Set(commits)]
}

function runPage(root: string, folder: string): RunPage {
  const absolute = path.join(root, folder)
  return {
    folder,
    report: fs.existsSync(path.join(absolute, 'report.html')),
    gallery: fs.existsSync(path.join(absolute, 'layout.html')),
    builds: buildsIn(absolute)
  }
}

function runEntry(run: string): RunEntry {
  const folder = path.join(REPORT_ROOT, run)
  const aboutFile = path.join(folder, 'about.txt')
  return {
    run,
    about: fs.existsSync(aboutFile)
      ? fs.readFileSync(aboutFile, 'utf8').trim()
      : '',
    pages: [
      runPage(REPORT_ROOT, run),
      ...subfolders(folder).map((variant) =>
        runPage(REPORT_ROOT, path.join(run, variant))
      )
    ]
  }
}

function writeRunIndex() {
  fs.writeFileSync(
    path.join(REPORT_ROOT, 'index.html'),
    renderRunIndex(subfolders(REPORT_ROOT).map(runEntry))
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

/** Writes a run's acceptance data, report and layout gallery to its own folder, and refreshes the index of all runs. */
export default class Nodes2AcceptanceReporter implements Reporter {
  private readonly finalResults = new Map<TestCase, TestResult>()

  onTestEnd(test: TestCase, result: TestResult) {
    if (isAcceptanceProject(test.parent.project()?.name ?? ''))
      this.finalResults.set(test, result)
  }

  onEnd(result: FullResult) {
    if (result.status === 'interrupted') return
    const wroteGallery = writeLayoutGallery()
    if (this.finalResults.size > 0) {
      const finishedAt = new Date().toISOString()
      writeProjectData(this.groupByProject(), currentCommit(), finishedAt)
      writeReport(finishedAt)
    }
    if (wroteGallery || this.finalResults.size > 0) writeRunIndex()
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
