import { describe, expect, it } from 'vitest'

import { transformRules, structuralTransforms } from './rules'

describe('transformRules', () => {
  function applyRule(ruleName: string, input: string): string {
    const rule = transformRules.find((r) => r.name === ruleName)
    if (!rule) throw new Error(`Rule not found: ${ruleName}`)
    if (typeof rule.replacement === 'string') {
      return input.replace(rule.pattern, rule.replacement)
    }
    return input.replace(
      rule.pattern,
      rule.replacement as (...args: string[]) => string
    )
  }

  describe('import transforms', () => {
    it('replaces { test, expect } from @playwright/test', () => {
      const input = `import { test, expect } from '@playwright/test'`
      const result = applyRule('replace-test-import', input)
      expect(result).toContain('comfyPageFixture as test')
      expect(result).toContain('comfyExpect as expect')
      expect(result).toContain("from '../fixtures/ComfyPage'")
    })

    it('replaces { expect, test } (reversed order)', () => {
      const input = `import { expect, test } from '@playwright/test'`
      const result = applyRule('replace-test-import', input)
      expect(result).toContain('comfyPageFixture as test')
    })

    it('replaces test-only import', () => {
      const input = `import { test } from '@playwright/test'`
      const result = applyRule('replace-test-only-import', input)
      expect(result).toContain('comfyPageFixture as test')
      expect(result).not.toContain('expect')
    })

    it('replaces expect-only import', () => {
      const input = `import { expect } from '@playwright/test'`
      const result = applyRule('replace-expect-only-import', input)
      expect(result).toContain('comfyExpect as expect')
      expect(result).not.toContain('comfyPageFixture')
    })
  })

  describe('fixture transforms', () => {
    it('replaces { page } with { comfyPage }', () => {
      const input = `test('my test', async ({ page }) => {`
      const result = applyRule('replace-page-destructure', input)
      expect(result).toContain('async ({ comfyPage })')
      expect(result).not.toContain('{ page }')
    })
  })

  describe('locator transforms', () => {
    it('removes page.goto calls', () => {
      const input = `  await page.goto('http://localhost:8188')\n  await page.click('button')`
      const result = applyRule('remove-goto', input)
      expect(result).not.toContain('page.goto')
      expect(result).toContain('page.click')
    })

    it('replaces page.locator("canvas")', () => {
      const input = `await page.locator('canvas').click()`
      const result = applyRule('replace-canvas-locator', input)
      expect(result).toBe('await comfyPage.canvas.click()')
    })

    it('replaces search box placeholder', () => {
      const input = `page.getByPlaceholder('Search Nodes...')`
      const result = applyRule('replace-search-placeholder', input)
      expect(result).toBe('comfyPage.searchBox.input')
    })

    it('replaces bare page. references with comfyPage.page.', () => {
      const input = `await page.click('button')`
      const result = applyRule('replace-bare-page', input)
      expect(result).toBe(`await comfyPage.page.click('button')`)
    })

    it('does not replace comfyPage.page. (no double-replace)', () => {
      const input = `await comfyPage.page.click('button')`
      const result = applyRule('replace-bare-page', input)
      expect(result).toBe(input)
    })
  })

  describe('wait transforms', () => {
    it('replaces waitForTimeout with nextFrame', () => {
      const input = `await page.waitForTimeout(1000);`
      const result = applyRule('replace-waitForTimeout', input)
      expect(result).toBe('await comfyPage.nextFrame()')
    })

    it('handles waitForTimeout without semicolon', () => {
      const input = `await page.waitForTimeout(500)`
      const result = applyRule('replace-waitForTimeout', input)
      expect(result).toBe('await comfyPage.nextFrame()')
    })
  })
})

describe('structuralTransforms', () => {
  const wrapInDescribe = structuralTransforms.find(
    (t) => t.name === 'wrap-in-describe'
  )!

  it('wraps a test in test.describe with tags', () => {
    const input = `import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test('does something', async ({ comfyPage }) => {
  await comfyPage.canvas.click()
})`

    const result = wrapInDescribe.apply(input, 'my-test', ['@canvas'])
    expect(result).toContain('test.describe(')
    expect(result).toContain('"my test"')
    expect(result).toContain('"@canvas"')
    expect(result).toContain('test.afterEach')
    expect(result).toContain('resetView')
  })

  it('skips wrapping when test.describe already exists', () => {
    const input = `test.describe('existing', () => {
  test('inner', async ({ comfyPage }) => {})
})`
    const result = wrapInDescribe.apply(input, 'test', ['@canvas'])
    expect(result).toBe(input)
  })

  it('converts hyphens and underscores to spaces in describe name', () => {
    const input = `import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test('x', async ({ comfyPage }) => {})`

    const result = wrapInDescribe.apply(input, 'my_test-name', ['@canvas'])
    expect(result).toContain('"my test name"')
  })
})
