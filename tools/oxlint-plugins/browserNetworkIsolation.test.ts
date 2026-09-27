import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const reportSchema = z.object({
  diagnostics: z.array(z.object({ code: z.string() }))
})

function isolationRules(filename: string) {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve('node_modules/oxlint/bin/oxlint'),
      '--config',
      path.resolve('.oxlintrc.json'),
      '--format=json',
      filename
    ],
    { encoding: 'utf8' }
  )
  expect(result.error).toBeUndefined()
  const { diagnostics } = reportSchema.parse(JSON.parse(result.stdout))
  return diagnostics
    .map(({ code }) => code)
    .filter((code) => /no-restricted-(imports|properties)/.test(code))
}

describe('browser network isolation lint rules', () => {
  it.for([
    [
      "import { test as base } from '@playwright/test'",
      'no-restricted-imports'
    ],
    ["import * as playwright from '@playwright/test'", 'no-restricted-imports'],
    ["export { test } from '@playwright/test'", 'no-restricted-imports'],
    ['route.continue()', 'no-restricted-properties'],
    ["handler['continue']()", 'no-restricted-properties'],
    ["import { expect } from '@playwright/test'", null],
    [
      "import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'",
      null
    ],
    ['route.fallback()', null]
  ] as const)('%s', ([source, rule]) => {
    const directory = mkdtempSync(
      path.resolve('browser_tests/fixtures/__network_policy_')
    )
    try {
      const filename = path.join(directory, 'fixture.ts')
      writeFileSync(filename, source)
      expect(isolationRules(filename)).toEqual(rule ? [`eslint(${rule})`] : [])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('allows the policy boundary to import Playwright and continue requests', () => {
    expect(
      isolationRules('browser_tests/fixtures/networkIsolationFixture.ts')
    ).toEqual([])
  })
})
