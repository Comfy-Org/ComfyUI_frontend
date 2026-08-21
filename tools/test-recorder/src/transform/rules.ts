interface TransformRule {
  name: string
  description: string
  pattern: RegExp
  replacement: string
  category: 'import' | 'fixture' | 'locator' | 'wait' | 'structure' | 'cleanup'
}

// Applied top to bottom. The specific page.* rules must precede
// replace-bare-page, which would otherwise claim their matches first.
export const transformRules: TransformRule[] = [
  {
    name: 'replace-test-import',
    description: 'Use comfyPageFixture instead of @playwright/test',
    pattern:
      /import\s*\{\s*(?:test\s*,?\s*expect|expect\s*,?\s*test)\s*\}\s*from\s*['"]@playwright\/test['"]/,
    replacement: `import {\n  comfyPageFixture as test,\n  comfyExpect as expect\n} from '@e2e/fixtures/ComfyPage'`,
    category: 'import'
  },
  {
    name: 'replace-test-only-import',
    description: 'Use comfyPageFixture when only test is imported',
    pattern: /import\s*\{\s*test\s*\}\s*from\s*['"]@playwright\/test['"]/,
    replacement: `import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'`,
    category: 'import'
  },
  {
    name: 'replace-expect-only-import',
    description: 'Use comfyExpect when only expect is imported',
    pattern: /import\s*\{\s*expect\s*\}\s*from\s*['"]@playwright\/test['"]/,
    replacement: `import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'`,
    category: 'import'
  },
  {
    name: 'replace-page-destructure',
    description: 'Use comfyPage fixture instead of page',
    pattern: /async\s*\(\s*\{\s*page\s*((?:,\s*\w+\s*)*)\}\s*\)/g,
    replacement: 'async ({ comfyPage$1})',
    category: 'fixture'
  },
  {
    name: 'remove-goto',
    description: 'Remove page.goto — fixture handles navigation',
    pattern: /^\s*await\s+page\.goto\s*\([^)]*\)\s*;?\s*$/gm,
    replacement: '',
    category: 'locator'
  },
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
    // Usage positions only: `page.x`, `expect(page)`, `f(page, ...)`. Anything
    // else — a property key, a word inside a string — is left alone.
    pattern: /(?<!['"`\w.])page(?=\s*[.),])/g,
    replacement: 'comfyPage.page',
    category: 'locator'
  },
  {
    name: 'replace-waitForTimeout',
    description: 'Use comfyPage.nextFrame() instead of arbitrary waits',
    pattern:
      /await\s+(?:comfyPage\.)?page\.waitForTimeout\s*\(\s*\d+\s*\)[ \t]*;?/g,
    replacement: 'await comfyPage.nextFrame()',
    category: 'wait'
  }
]

interface StructuralTransform {
  name: string
  description: string
  apply: (
    code: string,
    testName: string,
    tags: string[],
    workflow?: string
  ) => string
}

export const structuralTransforms: StructuralTransform[] = [
  {
    name: 'load-recorded-workflow',
    description: 'Load the workflow the recording started from',
    apply: (
      code: string,
      _testName: string,
      _tags: string[],
      workflow?: string
    ) => {
      if (!workflow) return code
      if (code.includes('loadWorkflow(')) return code

      // Codegen starts at the Record button, so the starting workflow is lost.
      return code.replace(
        /(test\s*\([^)]*async\s*\(\s*\{\s*comfyPage[^}]*\}\s*\)\s*=>\s*\{\n)/,
        `$1  await comfyPage.workflow.loadWorkflow(${JSON.stringify(workflow)})\n  await comfyPage.nextFrame()\n`
      )
    }
  },
  {
    name: 'name-the-test',
    description: 'Give the test a descriptive title',
    apply: (code: string, testName: string) => {
      // playwright/valid-title rejects codegen's default test('test', ...).
      const readable = testName
        .replace(/[-_]/g, ' ')
        .replace(/\.spec\.ts$/, '')
        .trim()
      if (!readable) return code
      return code.replace(
        /(\btest(?:\.(?:only|skip|fixme))?\s*\(\s*)(['"])test\2/,
        (_match, prefix: string) => `${prefix}'${readable} works as recorded'`
      )
    }
  },
  {
    name: 'wrap-in-describe',
    description: 'Wrap test in test.describe with tags and afterEach',
    apply: (code: string, testName: string, tags: string[]) => {
      if (code.includes('test.describe')) return code

      const tagStr = tags.map((t) => JSON.stringify(t)).join(', ')
      const descName = JSON.stringify(
        testName.replace(/[-_]/g, ' ').replace(/\.spec\.ts$/, '')
      )

      const testMatch = code.match(
        /^(import[\s\S]*?\n\n?)(test(?:\.(?:only|skip|fixme))?\s*\([\s\S]*)$/m
      )
      if (!testMatch) return code

      const imports = testMatch[1]
      const testBody = testMatch[2]

      return `${imports.replace(/\n*$/, '\n\n')}test.describe(${descName}, { tag: [${tagStr}] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  ${testBody.replace(/^(?=.)/gm, '  ').trimStart()}
})\n`
    }
  }
]
