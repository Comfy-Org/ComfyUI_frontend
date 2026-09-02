import { describe, expect, it } from 'vitest'

import { transform } from './engine'

/**
 * Driven through transform() rather than the rule table, so these cover rule
 * ordering — which is load-bearing — and survive a rule being renamed.
 */
function run(body: string, testName = 'demo'): string {
  return transform(body, { testName }).code
}

const CODEGEN = `import { expect, test } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.locator('canvas').click();
  await expect(page.locator('canvas')).toBeVisible();
});`

describe('imports', () => {
  it('swaps the playwright import for the comfyPage fixture', () => {
    const code = run(CODEGEN)
    expect(code).toContain("from '@e2e/fixtures/ComfyPage'")
    expect(code).not.toContain('@playwright/test')
  })

  it('handles a reversed import list', () => {
    expect(
      run(CODEGEN.replace('{ expect, test }', '{ test, expect }'))
    ).toContain("from '@e2e/fixtures/ComfyPage'")
  })

  it('handles a test-only import', () => {
    const code = run(CODEGEN.replace('{ expect, test }', '{ test }'))
    expect(code).toContain('comfyPageFixture as test')
  })
})

describe('fixture and locator rewrites', () => {
  it('drops the goto the fixture already performs', () => {
    expect(run(CODEGEN)).not.toContain('goto')
  })

  it('uses the canvas locator the fixture exposes', () => {
    const code = run(CODEGEN)
    expect(code).toContain('comfyPage.canvas.click()')
    expect(code).not.toContain("locator('canvas')")
  })

  it('rewrites the search box to its fixture helper', () => {
    const code = run(
      CODEGEN.replace(
        "await page.locator('canvas').click();",
        "await page.getByPlaceholder('Search Nodes...').fill('KSampler');"
      )
    )
    expect(code).toContain('comfyPage.searchBox.input.fill')
  })

  it('rewrites a bare page argument, not just page.<member>', () => {
    const code = run(
      CODEGEN.replace(
        "await expect(page.locator('canvas')).toBeVisible();",
        'await expect(page).toHaveTitle(/ComfyUI/);'
      )
    )
    expect(code).toContain('expect(comfyPage.page).toHaveTitle')
    expect(code).not.toMatch(/(?<![\w.])page(?![\w.])/)
  })

  it('leaves an already-converted fixture alone', () => {
    expect(run(CODEGEN)).not.toContain('comfyPage.comfyPage')
  })

  it('does not rewrite "page" inside a string literal', () => {
    const code = run(
      CODEGEN.replace(
        "await expect(page.locator('canvas')).toBeVisible();",
        "await page.getByText('page').click();"
      )
    )
    expect(code).toContain("comfyPage.page.getByText('page')")
  })

  it('does not rewrite "page" as an object property name', () => {
    const code = run(CODEGEN.replace('test(', 'const { page } = ctx;\ntest('))
    expect(code).toContain('const { page } = ctx;')
  })
})

describe('waits', () => {
  it('replaces an arbitrary wait with a frame boundary', () => {
    const code = run(
      CODEGEN.replace(
        "await page.locator('canvas').click();",
        'await page.waitForTimeout(500);'
      )
    )
    expect(code).toContain('await comfyPage.nextFrame()')
    expect(code).not.toContain('waitForTimeout')
  })

  it('replaces it even without a trailing semicolon', () => {
    const code = run(
      CODEGEN.replace(
        "await page.locator('canvas').click();",
        'await page.waitForTimeout(500)'
      )
    )
    expect(code).toContain('await comfyPage.nextFrame()')
  })

  it('keeps the following statement on its own line', () => {
    const code = run(
      CODEGEN.replace(
        "await page.locator('canvas').click();",
        'await page.waitForTimeout(500)'
      )
    )
    expect(code).not.toMatch(/nextFrame\(\)[ \t]*await/)
  })
})

describe('structure', () => {
  it('wraps the test with tags and a view reset', () => {
    const code = transform(CODEGEN, {
      testName: 'demo',
      tags: ['@canvas', '@smoke']
    }).code
    expect(code).toContain(`test.describe("demo"`)
    expect(code).toContain(`tag: ["@canvas", "@smoke"]`)
    expect(code).toContain('comfyPage.canvasOps.resetView()')
  })

  it('does not wrap a describe block twice', () => {
    const once = run(CODEGEN)
    expect(transform(once, { testName: 'demo' }).code).toBe(once)
  })

  it('names the test, since valid-title rejects codegen default', () => {
    const code = run(CODEGEN)
    expect(code).not.toMatch(/test\(\s*'test'/)
    expect(code).toContain('demo works as recorded')
  })

  it('separates the imports from the describe block', () => {
    expect(run(CODEGEN)).toMatch(
      /from '@e2e\/fixtures\/ComfyPage';?\n\ntest\.describe/
    )
  })
})

describe('starting workflow', () => {
  it('loads the workflow the recording started from', () => {
    const code = transform(CODEGEN, {
      testName: 'demo',
      workflow: 'default'
    }).code
    expect(code).toContain('await comfyPage.workflow.loadWorkflow("default")')
  })

  it('adds nothing when recording started on an empty canvas', () => {
    expect(run(CODEGEN)).not.toContain('loadWorkflow')
  })

  it('does not double-load a workflow the code already loads', () => {
    const already = CODEGEN.replace(
      "await page.locator('canvas').click();",
      "await comfyPage.workflow.loadWorkflow('other');"
    )
    const code = transform(already, {
      testName: 'demo',
      workflow: 'default'
    }).code
    expect(code.match(/loadWorkflow/g)).toHaveLength(1)
  })

  it.for([
    "it's/one",
    String.raw`evil'); process.exit(1); //`,
    String.raw`back\slash`
  ])('emits %j as data, not code', (workflow) => {
    const code = transform(CODEGEN, { testName: 'demo', workflow }).code
    const emitted = code.match(/loadWorkflow\((.*)\)$/m)
    expect(emitted).not.toBeNull()
    expect(JSON.parse(emitted![1])).toBe(workflow)
  })
})

describe('warnings', () => {
  it('warns when a recording captured no assertion', () => {
    const { warnings } = transform(
      CODEGEN.replace(
        "  await expect(page.locator('canvas')).toBeVisible();\n",
        ''
      ),
      { testName: 'demo' }
    )
    expect(warnings.some((w) => w.includes('No assertions'))).toBe(true)
  })

  it('stays quiet when the recording does assert', () => {
    expect(
      transform(CODEGEN, { testName: 'demo' }).warnings.some((w) =>
        w.includes('No assertions')
      )
    ).toBe(false)
  })

  it('warns when only the recorded statements were pasted', () => {
    const { warnings } = transform("await page.locator('canvas').click();", {
      testName: 'demo'
    })
    expect(warnings.some((w) => w.includes('No test() call'))).toBe(true)
  })
})
