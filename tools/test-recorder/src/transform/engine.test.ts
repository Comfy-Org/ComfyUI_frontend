import { describe, expect, it } from 'vitest'

import { transform, formatTransformSummary } from './engine'

describe('transform', () => {
  const rawCodegenOutput = `import { test, expect } from '@playwright/test'

test('my test', async ({ page }) => {
  await page.goto('http://localhost:8188')
  await page.locator('canvas').click()
  await page.waitForTimeout(1000)
  await page.getByPlaceholder('Search Nodes...').fill('KSampler')
})`

  it('applies all applicable regex rules', () => {
    const result = transform(rawCodegenOutput, {
      testName: 'canvas-test',
      tags: ['@canvas']
    })
    expect(result.code).toContain('comfyPageFixture as test')
    expect(result.code).toContain('async ({ comfyPage })')
    expect(result.code).not.toContain('page.goto')
    expect(result.code).toContain('comfyPage.canvas')
    expect(result.code).toContain('comfyPage.nextFrame()')
    expect(result.code).toContain('comfyPage.searchBox.input')
  })

  it('wraps test in describe block', () => {
    const result = transform(rawCodegenOutput, {
      testName: 'canvas-test',
      tags: ['@canvas']
    })
    expect(result.code).toContain('test.describe(')
    expect(result.code).toContain('"canvas test"')
  })

  it('injects feature flags between imports and the test suite', () => {
    const result = transform(rawCodegenOutput, {
      featureFlags: { onboarding_tour_enabled: true }
    })
    const importAt = result.code.indexOf("from '@e2e/fixtures/ComfyPage'")
    const useAt = result.code.indexOf('test.use({')
    const describeAt = result.code.indexOf('test.describe(')
    expect(useAt).toBeGreaterThan(importAt)
    expect(useAt).toBeLessThan(describeAt)
    expect(result.code).toContain('onboarding_tour_enabled: true')
  })

  it('warns about remaining pixel coordinates', () => {
    const input = `import { test } from '@playwright/test'

test('pos test', async ({ page }) => {
  await page.click({ position: { x: 100, y: 200 } })
})`
    const result = transform(input)
    expect(result.warnings).toContainEqual(
      expect.stringContaining('pixel coordinates')
    )
  })

  it('warns when the recording uploads a local file', () => {
    const input = `import { test } from '@playwright/test'

test('upload', async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles('/Users/me/my-workflow.json')
})`
    const result = transform(input)
    expect(result.warnings).toContainEqual(
      expect.stringContaining('will not exist where tests run')
    )
  })

  it('uses default testName and tags when not provided', () => {
    const result = transform(rawCodegenOutput)
    expect(result.code).toContain('"unnamed test"')
    expect(result.code).toContain('"@canvas"')
  })

  it('collapses triple blank lines', () => {
    const input = `import { test } from '@playwright/test'



test('x', async ({ page }) => {})`
    const result = transform(input)
    expect(result.code).not.toMatch(/\n{3,}/)
  })

  it('returns code ending with a single newline', () => {
    const result = transform(rawCodegenOutput)
    expect(result.code).toMatch(/[^\n]\n$/)
  })

  it('scrubs credential-shaped input before transforming', () => {
    const input = `import { test, expect } from '@playwright/test'

test('login', async ({ page }) => {
  await page.getByLabel('Password').fill('hunter2')
  await page.locator('canvas').click()
})`
    const result = transform(input)
    expect(result.code).not.toContain('hunter2')
    expect(result.securityFindings).toHaveLength(1)
  })

  it('reports no security findings for clean input', () => {
    const result = transform(rawCodegenOutput)
    expect(result.securityFindings).toEqual([])
  })
})

describe('formatTransformSummary', () => {
  it('formats applied rules with checkmarks', () => {
    const lines = formatTransformSummary({
      code: '',
      appliedRules: [{ name: 'test-rule', description: 'Did a thing' }],
      warnings: [],
      securityFindings: []
    })
    expect(lines).toEqual(['✅ Did a thing'])
  })

  it('formats warnings', () => {
    const lines = formatTransformSummary({
      code: '',
      appliedRules: [],
      warnings: ['Something is wrong'],
      securityFindings: []
    })
    expect(lines).toEqual(['⚠️  Something is wrong'])
  })

  it('returns empty array when no rules or warnings', () => {
    const lines = formatTransformSummary({
      code: '',
      appliedRules: [],
      warnings: [],
      securityFindings: []
    })
    expect(lines).toEqual([])
  })

  it('formats security findings with a lock marker', () => {
    const lines = formatTransformSummary({
      code: '',
      appliedRules: [],
      warnings: [],
      securityFindings: ['Removed typing into a sensitive field (line 4)']
    })
    expect(lines).toEqual(['🔒 Removed typing into a sensitive field (line 4)'])
  })
})
