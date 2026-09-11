import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RouterModelReportUpdate } from './router-model-report'
import { openRouterModelReport } from './router-model-report'

vi.mock(import('../src/config/workshop-model-availability'), () => ({
  workshopModelAvailability: new Map([
    ['test-disabled', { disabled: true, reason: 'Provider rejects defaults' }],
    ['test-enabled', { disabled: false, reason: 'Fixed and retested' }]
  ]),
  isWorkshopModelDisabled: (slug: string) => slug === 'test-disabled'
}))

let directory: string
let paths: { jsonPath: string; markdownPath: string }
const reports: ReturnType<typeof openRouterModelReport>[] = []

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'router-model-report-'))
  paths = {
    jsonPath: join(directory, 'testing', 'models-test-results.json'),
    markdownPath: join(directory, 'MODELS_TEST_RESULTS.md')
  }
})

afterEach(() => {
  for (const report of reports.splice(0)) report.close()
  rmSync(directory, { recursive: true, force: true })
})

function openReport() {
  const report = openRouterModelReport(paths)
  reports.push(report)
  return report
}

const firstDate = '2026-09-10T12:00:00.000Z'
const nextDate = '2026-09-11T12:00:00.000Z'
const requestId = '082b4def-4c8e-4127-bfbe-43854cedf2ec'
const model: RouterModelReportUpdate = {
  slug: 'test_image-1.0',
  routerId: 'provider/model',
  modality: 'image',
  environment: 'prod',
  inputMode: 'page-defaults'
}
const passed: RouterModelReportUpdate['live'] = {
  status: 'passed',
  at: firstDate,
  requestId,
  source: { revision: '0123456789abcdef', dirty: true },
  artifacts: [
    {
      kind: 'image',
      bytes: 1024,
      sha256: 'a'.repeat(64),
      width: 256,
      height: 256
    }
  ]
}

describe('persistent model results', () => {
  it('shows which failing pages are disabled on the site', () => {
    const report = openReport()
    const failed: RouterModelReportUpdate['live'] = {
      status: 'failed',
      at: nextDate,
      failure: 'invalid-input'
    }
    report.update({ ...model, slug: 'test-disabled', live: failed })
    report.update({ ...model, slug: 'test-enabled', live: failed })
    const grid = readFileSync(paths.markdownPath, 'utf8')
    expect(grid).toContain(
      '| test-disabled | prod / page-defaults | Router rejected the mapped inputs | Disabled |'
    )
    expect(grid).toContain(
      '| test-enabled | prod / page-defaults | Router rejected the mapped inputs | Published |'
    )
    expect(grid).toContain('Disabled on the site: Provider rejects defaults')
    expect(grid).not.toContain('Fixed and retested')
    expect(grid).toContain('Pages disabled on the site: 1.')
  })

  it('preserves live passes and unrelated cases through partial preflight runs', () => {
    const report = openReport()
    report.update({ ...model, live: passed })
    report.update({ ...model, environment: 'test', live: passed })
    report.update({ ...model, inputMode: 'custom-inputs', live: passed })
    report.close()

    const resumed = openReport()
    resumed.update({
      ...model,
      preflight: {
        status: 'failed',
        at: nextDate,
        fields: ['source_images'],
        source: { revision: 'fedcba9876543210' }
      }
    })
    const saved: unknown = JSON.parse(readFileSync(paths.jsonPath, 'utf8'))
    expect(saved).toMatchObject({
      models: [
        { inputMode: 'custom-inputs', live: passed },
        {
          inputMode: 'page-defaults',
          live: passed,
          lastSuccess: passed,
          preflight: { status: 'failed', at: nextDate }
        },
        { environment: 'test', live: passed }
      ]
    })
    const grid = readFileSync(paths.markdownPath, 'utf8')
    expect(grid).toContain('Default preflight failures: 1')
    expect(grid).toContain(
      'Defaults: fedcba98<br>Live: 01234567 + uncommitted changes'
    )
    expect(grid).toContain(`failed (${nextDate})`)
    expect(grid).toContain(`passed (${firstDate})`)
  })

  it('retains the last success after a real failure and ignores older results', () => {
    const report = openReport()
    report.update({ ...model, live: passed })
    report.update({
      ...model,
      live: { status: 'failed', at: nextDate, failure: 'invalid-input' }
    })
    report.update({ ...model, live: passed })
    const saved: unknown = JSON.parse(readFileSync(paths.jsonPath, 'utf8'))
    expect(saved).toMatchObject({
      models: [
        { live: { status: 'failed', at: nextDate }, lastSuccess: passed }
      ]
    })
    const grid = readFileSync(paths.markdownPath, 'utf8')
    expect(grid).toContain('passed: 0; failed: 1')
    expect(grid).toContain(`${firstDate}<br>Request ${requestId}`)
    expect(grid).toContain('Router rejected the mapped inputs')
  })

  it('preserves late collection evidence when reopening for a preflight run', () => {
    const collected: RouterModelReportUpdate['live'] = {
      ...passed,
      completion: 'collected-after-timeout'
    }
    const report = openReport()
    report.update({ ...model, live: collected })
    report.close()

    const resumed = openReport()
    resumed.update({
      ...model,
      preflight: { status: 'ready', at: nextDate }
    })

    const saved: unknown = JSON.parse(readFileSync(paths.jsonPath, 'utf8'))
    expect(saved).toMatchObject({
      models: [
        {
          live: collected,
          lastSuccess: collected,
          preflight: { status: 'ready', at: nextDate }
        }
      ]
    })
    const grid = readFileSync(paths.markdownPath, 'utf8')
    expect(grid).toContain('Collected after initial timeout')
    expect(grid).toContain(`passed (${firstDate})`)
    expect(grid).toContain('[Model testing](MODEL_TESTING.md)')
  })

  it('counts account limits as blocked without declaring the model broken', () => {
    const report = openReport()
    report.update({
      ...model,
      live: {
        status: 'blocked',
        at: firstDate,
        failure: 'concurrency-limit',
        httpStatus: 429
      }
    })
    report.update({ ...model, slug: 'untested-model' })
    const grid = readFileSync(paths.markdownPath, 'utf8')
    expect(grid).toContain('failed: 0; blocked: 1; cancelled: 0; not-run: 1')
    expect(grid).toContain(
      'Account concurrency limit; retry when capacity is free'
    )
    expect(() =>
      report.update({
        ...model,
        live: { status: 'failed', at: nextDate, failure: 'concurrency-limit' }
      })
    ).toThrow('blocked')
  })

  it('requires decoded evidence of the expected media type for every pass', () => {
    const report = openReport()
    expect(() =>
      report.update({
        ...model,
        live: { status: 'passed', at: firstDate, artifacts: [] }
      })
    ).toThrow('artifact evidence')
    expect(() =>
      report.update({
        ...model,
        modality: 'video',
        live: passed
      })
    ).toThrow('Artifact kind')
    expect(() =>
      report.update({
        ...model,
        live: {
          ...passed,
          artifacts: [{ kind: 'image', bytes: 100, sha256: 'a'.repeat(64) }]
        }
      })
    ).toThrow('dimensions')
  })

  it.for(['3d', 'text', 'other'] as const)(
    'keeps %s inventory visible without claiming a supported verification',
    (modality) => {
      const report = openReport()
      report.update({ ...model, live: passed })
      const unsupported = { ...model, slug: 'unsupported-model', modality }
      report.update(unsupported)
      report.close()

      const resumed = openReport()
      resumed.flush()
      const saved: unknown = JSON.parse(readFileSync(paths.jsonPath, 'utf8'))
      expect(saved).toMatchObject({
        models: [
          { slug: model.slug, live: passed, lastSuccess: passed },
          unsupported
        ]
      })
      const grid = readFileSync(paths.markdownPath, 'utf8')
      expect(grid).toContain(
        'passed: 1; failed: 0; blocked: 0; cancelled: 0; not-run: 1'
      )
      expect(grid).toContain(
        `| ${modality} | prod / page-defaults | not checked | not-run | Live verification is not supported for this output type | — |`
      )
      expect(() => resumed.update({ ...unsupported, live: passed })).toThrow(
        'Artifact kind'
      )
      expect(readFileSync(paths.markdownPath, 'utf8')).toBe(grid)
    }
  )

  it('publishes only allowlisted evidence and rejects unsafe identifiers', () => {
    const report = openReport()
    const privateRecord = {
      ...model,
      message: 'Bearer SECRET https://provider.example/signed?token=SECRET',
      live: {
        ...passed,
        response: { body: 'SECRET' },
        artifacts: passed.artifacts?.map((artifact) => ({
          ...artifact,
          path: '/Users/private/artifact.png',
          url: 'https://provider.example/signed?token=SECRET'
        }))
      }
    }
    report.update(privateRecord)
    const json = readFileSync(paths.jsonPath, 'utf8')
    const grid = readFileSync(paths.markdownPath, 'utf8')
    for (const sensitive of ['SECRET', '/Users/private', 'provider.example']) {
      expect(json).not.toContain(sensitive)
      expect(grid).not.toContain(sensitive)
    }
    expect(grid).toContain(
      '[test\\_image-1.0](https://www.comfy.org/models/test_image-1.0/)'
    )
    expect(() => report.update({ ...model, slug: 'bad|<img>\nrow' })).toThrow()
    expect(() =>
      report.update({
        ...model,
        preflight: { status: 'failed', at: nextDate, fields: ['field|secret'] }
      })
    ).toThrow()
    expect(readFileSync(paths.jsonPath, 'utf8')).toBe(json)
  })

  it('locks reports across processes and permits reopening after close', () => {
    const report = openReport()
    expect(() => openRouterModelReport(paths)).toThrow('locked')
    report.update(model)
    report.close()
    const reopened = openReport()
    reopened.flush()
    expect(() => report.update(model)).toThrow('closed')
    expect(readFileSync(paths.markdownPath, 'utf8')).toContain('1 cases')
  })

  it('fails on damaged saved results without overwriting evidence or leaving a lock', () => {
    const report = openReport()
    report.update(model)
    report.close()
    writeFileSync(paths.jsonPath, '{broken')
    expect(() => openRouterModelReport(paths)).toThrow()
    expect(readFileSync(paths.jsonPath, 'utf8')).toBe('{broken')
    writeFileSync(paths.jsonPath, '{"version":1,"models":[]}')
    expect(() => openReport()).not.toThrow()
  })
})
