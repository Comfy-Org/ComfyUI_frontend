import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, it, onTestFinished, vi } from 'vitest'
import { z } from 'zod'

import { writeReportFile } from '../../browser_tests/reporters/nodes2Acceptance/reportFiles'

it('keeps published evidence intact when a replacement write fails', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-write-'))
  onTestFinished(() => fs.rmSync(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'published.json')
  fs.writeFileSync(file, 'previous evidence')
  vi.spyOn(fs, 'writeFileSync').mockImplementationOnce((target) => {
    fs.appendFileSync(target, 'partial evidence')
    throw new Error('disk full')
  })
  expect(() => writeReportFile(file, 'replacement')).toThrow('disk full')
  expect(fs.readFileSync(file, 'utf8')).toBe('previous evidence')
  expect(fs.readdirSync(directory)).toEqual(['published.json'])
})

it.for(['failed', 'timedOut'] as const)(
  'retains a %s attempt when its retry passes',
  { timeout: 30_000 },
  (status) => {
    const root = path.resolve(import.meta.dirname, '../..')
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'acceptance-retry-')
    )
    onTestFinished(() => fs.rmSync(directory, { recursive: true, force: true }))
    fs.symlinkSync(
      path.join(root, 'node_modules'),
      path.join(directory, 'node_modules')
    )
    fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}')
    fs.writeFileSync(
      path.join(directory, 'playwright.config.ts'),
      `export default {
        testDir: '.', retries: 1, workers: 1,
        tsconfig: ${JSON.stringify(path.join(root, 'browser_tests/tsconfig.json'))},
        reporter: [[${JSON.stringify(path.join(root, 'browser_tests/reporters/nodes2AcceptanceReporter.ts'))}]],
        projects: [{ name: 'nodes2-acceptance' }]
      }`
    )
    fs.writeFileSync(
      path.join(directory, 'retry.spec.ts'),
      `import { test, expect } from '@playwright/test'
      test.describe('Node input acceptance: classic', () => {
        test('widget rows are 20 px tall', () => {})
      })
      test.describe('Node input acceptance: Nodes 2.0', { tag: '@vue-nodes' }, () => {
        test('widget rows are 20 px tall', async ({}, info) => {
          if (info.retry === 0) {
            if (${JSON.stringify(status)} === 'timedOut') {
              test.setTimeout(100)
              await new Promise(() => {})
            }
            expect(24).toBe(20)
          }
        })
      })`
    )
    const result = spawnSync(
      path.join(root, 'node_modules/.bin/playwright'),
      ['test', '--config', path.join(directory, 'playwright.config.ts')],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          NODES2_ACCEPTANCE_RUN: 'retry',
          NODES2_ACCEPTANCE_REPORT_DIR: path.join(directory, 'external-output')
        }
      }
    )
    expect(result.status).toBe(0)
    const data = z
      .object({
        tests: z.array(z.object({ status: z.string() }))
      })
      .parse(
        JSON.parse(
          fs.readFileSync(
            path.join(directory, 'external-output/data/nodes2-acceptance.json'),
            'utf8'
          )
        )
      )
    expect(data.tests.map((test) => test.status)).toEqual([
      'passed',
      status,
      'passed'
    ])
    expect(
      fs.readFileSync(
        path.join(directory, 'external-output/report.html'),
        'utf8'
      )
    ).toContain(`inconsistent across repeated runs (${status}, passed)`)
    expect(
      fs.readFileSync(
        path.join(directory, 'external-output/index.html'),
        'utf8'
      )
    ).toContain('href="./report.html"')
  }
)
