// @vitest-environment jsdom
// happy-dom (the repo default) resolves @playwright/test's absolute import
// against http://localhost:3000 and dumps an unhandled ECONNREFUSED.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import type { PlaywrightTestConfig } from '@playwright/test'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'

// The cloud env seeds a real Firebase session, and page.evaluate arguments are
// recorded verbatim in a trace that CI uploads as a public artifact. Tracing
// must therefore be off under CUSTOM_NODES_ENV=cloud - the one invariant in
// this suite whose failure leaks a credential rather than reddening a test.
async function customNodesTrace(
  customNodesEnv: string | undefined
): Promise<unknown> {
  vi.resetModules()
  vi.stubEnv('CUSTOM_NODES_ENV', customNodesEnv)
  try {
    const config = (await import('../playwright.config')).default
    const project = config.projects?.find(
      (candidate) => candidate.name === 'custom-nodes'
    )
    if (!project) throw new Error('custom-nodes project is gone')
    return (project.use as PlaywrightTestConfig['use'])?.trace
  } finally {
    vi.unstubAllEnvs()
  }
}

describe('custom-nodes Playwright tracing', () => {
  it('is off under the cloud env, so a seeded session cannot reach an artifact', async () => {
    expect(await customNodesTrace('cloud')).toBe('off')
  })

  it('is retained on failure everywhere else, so a red core run stays debuggable', async () => {
    expect(await customNodesTrace(undefined)).toBe('retain-on-failure')
    expect(await customNodesTrace('core')).toBe('retain-on-failure')
  })
})

interface WorkflowStep {
  name?: string
  env?: Record<string, unknown>
  run?: string
}

function workflowSteps(path: string): WorkflowStep[] {
  const workflow = parse(readFileSync(path, 'utf8')) as {
    jobs: Record<string, { steps?: WorkflowStep[] }>
  }
  return Object.values(workflow.jobs).flatMap((job) => job.steps ?? [])
}

function runCloudActivationGate(evidenceKey: string | undefined) {
  const gate = workflowSteps(
    '.github/workflows/ci-tests-custom-nodes-cloud.yaml'
  ).find((step) => step.name === 'Gate on cloud secrets and manifest')
  if (!gate?.run) throw new Error('Cloud activation gate is missing')
  const cwd = mkdtempSync(join(tmpdir(), 'custom-node-cloud-gate-'))
  const output = join(cwd, 'github-output')
  try {
    return spawnSync('bash', ['-c', gate.run], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        CLOUD_HTTP_502_EVIDENCE_KEY: evidenceKey ?? '',
        GITHUB_OUTPUT: output,
        SMOKE_ACCOUNT_EMAIL: 'smoke@example.com',
        SMOKE_ACCOUNT_PASSWORD: 'smoke-password'
      }
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

interface WorkflowGate {
  path: string
  total: number
  resultFile: string
  deferS13ToS15: boolean
  collectionLabel: string
}

const workflowGates: WorkflowGate[] = [
  {
    path: '.github/workflows/ci-tests-custom-nodes.yaml',
    total: 34,
    resultFile: 'custom-nodes-results.json',
    deferS13ToS15: false,
    collectionLabel: 'active Core custom-node tests'
  },
  {
    path: '.github/workflows/ci-tests-custom-nodes-cloud.yaml',
    total: 185,
    resultFile: 'custom-nodes-cloud-results.json',
    deferS13ToS15: true,
    collectionLabel: 'S1-S12 tests'
  }
]

function runResultGate(
  workflow: WorkflowGate,
  json: object | string | undefined
) {
  const resultGate = workflowSteps(workflow.path).find(
    (step) => step.name === 'Forbid failed, skipped, or flaky tests'
  )
  if (!resultGate?.run)
    throw new Error(`result gate missing in ${workflow.path}`)
  const cwd = mkdtempSync(join(tmpdir(), 'custom-node-result-gate-'))
  const resultPath = join(cwd, workflow.resultFile)
  try {
    if (json !== undefined)
      writeFileSync(
        resultPath,
        typeof json === 'string' ? json : JSON.stringify(json)
      )
    return spawnSync('bash', ['-c', resultGate.run], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        EXPECTED_TESTS: String(workflow.total),
        SUITE_OUTCOME: 'success'
      }
    })
  } finally {
    if (existsSync(resultPath)) unlinkSync(resultPath)
    rmdirSync(cwd)
  }
}

function resultJson(expected: number, unexpected = 0, flaky = 0, skipped = 0) {
  return { stats: { expected, unexpected, flaky, skipped } }
}

describe('custom-node S1-S12 workflow gates', () => {
  it('accepts the Cloud gate only with a canonical 32-byte evidence key', () => {
    expect(
      runCloudActivationGate(Buffer.alloc(32, 7).toString('base64')).status
    ).toBe(0)
  })

  it.for([
    { name: 'missing', key: undefined },
    {
      name: 'invalid base64 characters',
      key: `${Buffer.alloc(32, 7).toString('base64')}!`
    },
    { name: '31 decoded bytes', key: Buffer.alloc(31, 7).toString('base64') },
    { name: '33 decoded bytes', key: Buffer.alloc(33, 7).toString('base64') }
  ])('rejects a $name Cloud evidence key', ({ key }) => {
    expect(runCloudActivationGate(key).status).not.toBe(0)
  })

  it.for(
    workflowGates.map((workflow) => ({
      ...workflow,
      name: workflow.path.includes('cloud') ? 'Cloud' : 'Core'
    }))
  )(
    '$name pins its exact active tier collection',
    ({ path, total, deferS13ToS15, collectionLabel }) => {
      const steps = workflowSteps(path)
      const suite = steps.find((step) =>
        step.name?.startsWith('Run custom-node')
      )
      const resultGate = steps.find(
        (step) => step.name === 'Forbid failed, skipped, or flaky tests'
      )
      const suiteCommand = suite?.run
        ?.split('\n')
        .filter((line) => !line.trimStart().startsWith('#'))
        .join('\n')

      if (deferS13ToS15)
        expect(suiteCommand).toContain('--grep-invert "interaction profiles:"')
      else
        expect(suiteCommand).not.toContain(
          '--grep-invert "interaction profiles:"'
        )
      expect(suiteCommand).toContain(
        'playwright test browser_tests/tests/customNodes/'
      )
      expect(suiteCommand?.match(/--project(?:=|\s+)\S+/g)).toEqual([
        '--project=custom-nodes'
      ])
      expect(suiteCommand?.match(/--reporter(?:=|\s+)\S+/g)).toEqual([
        '--reporter=./browser_tests/fixtures/customNode/cloudTraceReporter.ts,list,json,html'
      ])
      expect(suiteCommand).toMatch(/(?:^|\s)--quiet(?:\s|$)/)
      expect(suite?.env).toMatchObject({
        CN_ENABLE_S14: deferS13ToS15 ? '0' : '1',
        CN_ENABLE_S15: deferS13ToS15 ? '0' : '1'
      })
      expect(suiteCommand?.match(/--workers(?:=|\s+)\S+/g)).toEqual([
        '--workers=1'
      ])
      expect(suiteCommand?.match(/--retries(?:=|\s+)\S+/g)).toEqual([
        '--retries=0'
      ])
      expect(suiteCommand).not.toMatch(/--shard(?:=|\s)/)
      expect(resultGate?.env?.EXPECTED_TESTS).toBe(total)
      expect(resultGate?.run).toContain(
        '[.stats.expected, .stats.unexpected, .stats.flaky, .stats.skipped] | add'
      )
      expect(resultGate?.run).toContain(
        `expected exactly $EXPECTED_TESTS ${collectionLabel}`
      )
    }
  )

  it.for(workflowGates)(
    '$path accepts only the exact all-green result',
    (workflow) => {
      const result = runResultGate(workflow, resultJson(workflow.total))
      expect(result.status).toBe(0)
    }
  )

  it.for(
    workflowGates.flatMap((workflow) => [
      {
        workflow,
        name: 'a smaller collection',
        json: resultJson(workflow.total - 1)
      },
      {
        workflow,
        name: 'a larger collection',
        json: resultJson(workflow.total + 1)
      },
      {
        workflow,
        name: 'an unexpected result',
        json: resultJson(workflow.total - 1, 1)
      },
      {
        workflow,
        name: 'a flaky result',
        json: resultJson(workflow.total - 1, 0, 1)
      },
      {
        workflow,
        name: 'a skipped result',
        json: resultJson(workflow.total - 1, 0, 0, 1)
      },
      { workflow, name: 'missing JSON', json: undefined },
      { workflow, name: 'malformed JSON', json: '{' }
    ])
  )('$workflow.path rejects $name', ({ workflow, json }) => {
    expect(runResultGate(workflow, json).status).not.toBe(0)
  })
})

describe('Cloud HTTP 502 reporter boundary', () => {
  it('redacts a concurrent assertion from the real JSON reporter', () => {
    const cwd = mkdtempSync(
      join(process.cwd(), '.cloud-502-reporter-boundary-')
    )
    const configPath = join(cwd, 'playwright.config.ts')
    const specPath = join(cwd, 'boundary.spec.ts')
    const reportPath = join(cwd, 'report.json')
    const htmlReportPath = join(cwd, 'html-report')
    const reporterPath = resolve(
      'browser_tests/fixtures/customNode/cloudTraceReporter.ts'
    )
    const bodySecret = 'reporter-body-secret-7f4d'
    const querySecret = 'reporter-query-secret-9a21'
    const evidenceKey = Buffer.alloc(32, 19).toString('base64')
    try {
      writeFileSync(
        configPath,
        `import { defineConfig } from '@playwright/test'\n` +
          `export default defineConfig({\n` +
          `  testDir: ${JSON.stringify(cwd)},\n` +
          `  reporter: [\n` +
          `    [${JSON.stringify(reporterPath)}],\n` +
          `    ['list'],\n` +
          `    ['json', { outputFile: ${JSON.stringify(reportPath)} }],\n` +
          `    ['html', { outputFolder: ${JSON.stringify(htmlReportPath)}, open: 'never' }]\n` +
          `  ],\n` +
          `  workers: 1,\n` +
          `  retries: 0\n` +
          `})\n`
      )
      writeFileSync(
        specPath,
        `import { expect, test as base } from '@playwright/test'\n` +
          `import { armCloudHttp502ReporterBoundary } from '../browser_tests/fixtures/customNode/cloudTraceReporter'\n` +
          `import { cloudHttp502EvidenceBinding, serializeCloudHttp502PublicEvidence } from '../browser_tests/fixtures/customNode/cloudHttp502Evidence'\n` +
          `const test = base.extend<{ boundary: void }>({\n` +
          `  boundary: [async ({}, use, testInfo) => {\n` +
          `    await use()\n` +
          `    armCloudHttp502ReporterBoundary(testInfo)\n` +
          `  }, { auto: true }]\n` +
          `})\n` +
          `test('reporter boundary', async () => {\n` +
          `  const body = process.env.REPORTER_BODY_SECRET\n` +
          `  const query = process.env.REPORTER_QUERY_SECRET\n` +
          `  test.info().annotations.push({ type: 'annotation-' + body, description: 'annotation-' + query })\n` +
          `  console.log(\`body=\${body} query=\${query}\`)\n` +
          `  await test.info().attach('secret-name-' + body, { body: 'attachment=' + query, contentType: 'text/plain' })\n` +
          `  await test.info().attach('cloud-http-502-responses.json', { body: serializeCloudHttp502PublicEvidence([{ status: 502, method: 'GET', url: 'https://cloud.example/api', headers: { 'cf-ray': 'abc-SJC' }, bodyCapture: 'unavailable' }], cloudHttp502EvidenceBinding(test.info())), contentType: 'application/vnd.comfy.cloud-http-502-responses+json' })\n` +
          `  await expect('actual', \`body=\${body} https://cloud.example/api?token=\${query}\`).toBe('expected')\n` +
          `})\n` +
          `test('reporter integrity gate', async () => {\n` +
          `  const evidence = serializeCloudHttp502PublicEvidence([{ status: 502, method: 'GET', url: 'https://cloud.example/api', headers: {}, bodyCapture: 'unavailable' }], cloudHttp502EvidenceBinding(test.info()))\n` +
          `  await test.info().attach('cloud-http-502-responses.json', { body: evidence, contentType: 'application/vnd.comfy.cloud-http-502-responses+json' })\n` +
          `  await test.info().attach('cloud-http-502-responses.json', { body: evidence, contentType: 'application/vnd.comfy.cloud-http-502-responses+json' })\n` +
          `})\n`
      )
      const result = spawnSync(
        'pnpm',
        [
          'exec',
          'playwright',
          'test',
          specPath,
          '--config',
          configPath,
          '--quiet'
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            REPORTER_BODY_SECRET: bodySecret,
            REPORTER_QUERY_SECRET: querySecret,
            CLOUD_HTTP_502_EVIDENCE_KEY: evidenceKey
          }
        }
      )
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(1)
      expect(result.stdout).not.toContain(bodySecret)
      expect(result.stdout).not.toContain(querySecret)
      expect(result.stderr).not.toContain(bodySecret)
      expect(result.stderr).not.toContain(querySecret)
      const report = readFileSync(reportPath, 'utf8')
      const findIntegritySpec = (value: unknown): unknown => {
        if (typeof value !== 'object' || value === null) return
        if (
          'title' in value &&
          value.title === 'reporter integrity gate' &&
          'tests' in value
        )
          return value
        for (const nested of Object.values(value)) {
          const found = findIntegritySpec(nested)
          if (found) return found
        }
      }
      expect(JSON.stringify(findIntegritySpec(JSON.parse(report)))).toContain(
        '"status":"failed"'
      )
      expect(report).toContain(
        'Test failure details redacted because this test observed an HTTP 502'
      )
      expect(report).not.toContain(bodySecret)
      expect(report).not.toContain(querySecret)
      expect(report).not.toContain(`secret-name-${bodySecret}`)
      expect(report).toContain('redacted-http-502-attachment.txt')
      expect(report).not.toContain(
        'application/vnd.comfy.cloud-http-502-responses+json'
      )
      const pending = [htmlReportPath]
      const htmlContents: string[] = []
      while (pending.length) {
        const path = pending.pop()!
        if (statSync(path).isDirectory())
          pending.push(...readdirSync(path).map((entry) => join(path, entry)))
        else htmlContents.push(readFileSync(path).toString('utf8'))
      }
      const htmlReport = htmlContents.join('\n')
      expect(htmlReport).not.toContain(bodySecret)
      expect(htmlReport).not.toContain(querySecret)
      expect(htmlReport).not.toContain(`secret-name-${bodySecret}`)
      const htmlIndex = readFileSync(join(htmlReportPath, 'index.html'), 'utf8')
      const encodedReport = htmlIndex.match(
        /<template id="playwrightReportBase64">data:application\/zip;base64,([^<]+)<\/template>/
      )?.[1]
      expect(encodedReport).toBeDefined()
      const htmlArchivePath = join(cwd, 'html-report-data.zip')
      writeFileSync(htmlArchivePath, Buffer.from(encodedReport!, 'base64'))
      const unpackedHtmlReport = spawnSync(
        'node',
        [
          '-e',
          `const { createRequire } = require('node:module')
const playwrightRequire = createRequire(require.resolve('@playwright/test'))
const { yauzl } = playwrightRequire('playwright-core/lib/utilsBundle')
yauzl.open(process.argv[1], { lazyEntries: true }, (openError, archive) => {
  if (openError) throw openError
  archive.readEntry()
  archive.on('entry', (entry) => archive.openReadStream(entry, (streamError, stream) => {
    if (streamError) throw streamError
    stream.pipe(process.stdout, { end: false })
    stream.on('end', () => archive.readEntry())
  }))
  archive.on('end', () => process.stdout.end())
})`,
          htmlArchivePath
        ],
        { encoding: 'utf8' }
      )
      expect(unpackedHtmlReport.error).toBeUndefined()
      expect(unpackedHtmlReport.status).toBe(0)
      expect(unpackedHtmlReport.stdout).not.toContain(bodySecret)
      expect(unpackedHtmlReport.stdout).not.toContain(querySecret)
      expect(unpackedHtmlReport.stdout).not.toContain(
        `secret-name-${bodySecret}`
      )
      expect(unpackedHtmlReport.stdout).not.toContain(
        '[test step redacted because this test observed an HTTP 502]'
      )
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
