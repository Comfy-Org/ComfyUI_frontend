interface TransformRule {
  name: string
  description: string
  pattern: RegExp
  replacement: string | ((match: string, ...groups: string[]) => string)
  category: 'import' | 'fixture' | 'locator' | 'wait' | 'structure' | 'cleanup'
}

export const transformRules: TransformRule[] = [
  // === Import transforms ===
  {
    name: 'replace-test-import',
    description: 'Use comfyPageFixture instead of @playwright/test',
    pattern:
      /import\s*\{\s*(?:test\s*,?\s*expect|expect\s*,?\s*test)\s*\}\s*from\s*['"]@playwright\/test['"]/,
    replacement: `import {\n  comfyPageFixture as test,\n  comfyExpect as expect\n} from '../fixtures/ComfyPage'`,
    category: 'import'
  },
  {
    name: 'replace-test-only-import',
    description: 'Use comfyPageFixture when only test is imported',
    pattern: /import\s*\{\s*test\s*\}\s*from\s*['"]@playwright\/test['"]/,
    replacement: `import { comfyPageFixture as test } from '../fixtures/ComfyPage'`,
    category: 'import'
  },
  {
    name: 'replace-expect-only-import',
    description: 'Use comfyExpect when only expect is imported',
    pattern: /import\s*\{\s*expect\s*\}\s*from\s*['"]@playwright\/test['"]/,
    replacement: `import { comfyExpect as expect } from '../fixtures/ComfyPage'`,
    category: 'import'
  },

  // === Fixture transforms ===
  {
    name: 'replace-page-destructure',
    description: 'Use comfyPage fixture instead of page',
    pattern: /async\s*\(\s*\{\s*page\s*(?:,\s*\w+\s*)*\}\s*\)/g,
    replacement: 'async ({ comfyPage })',
    category: 'fixture'
  },

  // === Remove page.goto ===
  {
    name: 'remove-goto',
    description: 'Remove page.goto — fixture handles navigation',
    pattern: /^\s*await\s+page\.goto\s*\([^)]*\)\s*;?\s*$/gm,
    replacement: '',
    category: 'locator'
  },

  // === Locator transforms ===
  {
    name: 'replace-canvas-locator',
    description: 'Use comfyPage.canvas instead of page.locator("canvas")',
    pattern: /page\.locator\(\s*['"]canvas['"]\s*\)/g,
    replacement: 'comfyPage.canvas',
    category: 'locator'
  },
  {
    name: 'replace-search-placeholder',
    description: 'Use comfyPage.searchBox for search input',
    pattern: /page\.getByPlaceholder\(\s*['"]Search\s+Nodes\.{0,3}['"]\s*\)/g,
    replacement: 'comfyPage.searchBox.input',
    category: 'locator'
  },
  {
    name: 'replace-bare-page',
    description: 'Replace bare page references with comfyPage.page',
    pattern: /(?<![\w.])page\./g,
    replacement: 'comfyPage.page.',
    category: 'locator'
  },

  // === Wait transforms ===
  {
    name: 'replace-waitForTimeout',
    description: 'Use comfyPage.nextFrame() instead of arbitrary waits',
    pattern:
      /await\s+(?:comfyPage\.)?page\.waitForTimeout\s*\(\s*\d+\s*\)\s*;?/g,
    replacement: 'await comfyPage.nextFrame()',
    category: 'wait'
  }
]

/**
 * Rules that need structural changes (not just regex replacement).
 * These are applied by the engine after regex rules.
 */
interface StructuralTransform {
  name: string
  description: string
  apply: (code: string, testName: string, tags: string[]) => string
}

export const structuralTransforms: StructuralTransform[] = [
  {
    name: 'wrap-in-describe',
    description: 'Wrap test in test.describe with tags and afterEach',
    apply: (code: string, testName: string, tags: string[]) => {
      // If already has test.describe, skip
      if (code.includes('test.describe')) return code

      const tagStr = tags.map((t) => JSON.stringify(t)).join(', ')
      const descName = JSON.stringify(
        testName.replace(/[-_]/g, ' ').replace(/\.spec\.ts$/, '')
      )

      // Find the test() call and wrap it
      const testMatch = code.match(/^(import[\s\S]*?\n\n?)(test(?:\.(?:only|skip|fixme))?\s*\([\s\S]*)$/m)
      if (!testMatch) return code

      const imports = testMatch[1]
      const testBody = testMatch[2]

      return `${imports}test.describe(${descName}, { tag: [${tagStr}] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  ${testBody.replace(/^(?=.)/gm, '  ').trimStart()}
})\n`
    }
  }
]
