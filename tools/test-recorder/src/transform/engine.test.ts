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

  it('tracks applied rules', () => {
    const result = transform(rawCodegenOutput, { testName: 'test' })
    const ruleNames = result.appliedRules.map((r) => r.name)
    expect(ruleNames).toContain('replace-test-import')
    expect(ruleNames).toContain('replace-page-destructure')
    expect(ruleNames).toContain('remove-goto')
    expect(ruleNames).toContain('replace-canvas-locator')
    expect(ruleNames).toContain('replace-waitForTimeout')
    expect(ruleNames).toContain('wrap-in-describe')
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
})

describe('formatTransformSummary', () => {
  it('formats applied rules with checkmarks', () => {
    const lines = formatTransformSummary({
      code: '',
      appliedRules: [{ name: 'test-rule', description: 'Did a thing' }],
      warnings: []
    })
    expect(lines).toEqual(['✅ Did a thing'])
  })

  it('formats warnings', () => {
    const lines = formatTransformSummary({
      code: '',
      appliedRules: [],
      warnings: ['Something is wrong']
    })
    expect(lines).toEqual(['⚠️  Something is wrong'])
  })

  it('returns empty array when no rules or warnings', () => {
    const lines = formatTransformSummary({
      code: '',
      appliedRules: [],
      warnings: []
    })
    expect(lines).toEqual([])
  })
})
