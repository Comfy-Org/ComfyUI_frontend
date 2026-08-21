import { transformRules, structuralTransforms } from './rules'

interface TransformResult {
  code: string
  appliedRules: { name: string; description: string }[]
  warnings: string[]
}

export function transform(
  rawCode: string,
  options: {
    testName?: string
    tags?: string[]
    workflow?: string
  } = {}
): TransformResult {
  const testName = options.testName ?? 'unnamed-test'
  const tags = options.tags ?? ['@canvas']

  let code = rawCode
  const appliedRules: { name: string; description: string }[] = []
  const warnings: string[] = []

  for (const rule of transformRules) {
    const before = code
    if (typeof rule.replacement === 'string') {
      code = code.replace(rule.pattern, rule.replacement)
    } else {
      code = code.replace(
        rule.pattern,
        rule.replacement as (...args: string[]) => string
      )
    }
    if (code !== before) {
      appliedRules.push({ name: rule.name, description: rule.description })
    }
  }

  code = code.replace(/\n{3,}/g, '\n\n')

  for (const transform of structuralTransforms) {
    const before = code
    code = transform.apply(code, testName, tags, options.workflow)
    if (code !== before) {
      appliedRules.push({
        name: transform.name,
        description: transform.description
      })
    }
  }

  if (code.includes('waitForTimeout')) {
    warnings.push(
      'Still contains waitForTimeout — replace with comfyPage.nextFrame() or retrying assertions'
    )
  }
  if (
    code.includes("from '@playwright/test'") ||
    code.includes('from "@playwright/test"')
  ) {
    warnings.push(
      'Still imports from @playwright/test — should use @e2e/fixtures/ComfyPage'
    )
  }
  if (!/\bexpect\s*\(/.test(code)) {
    warnings.push(
      'No assertions — the playwright/expect-expect lint rule rejects this, so the commit hook will refuse it. Add an assertion in the Inspector before stopping.'
    )
  }
  if (/position:\s*\{\s*x:\s*\d+,\s*y:\s*\d+/.test(code)) {
    warnings.push(
      'Contains pixel coordinates — consider replacing with node references (comfyPage.nodeOps.*) where possible'
    )
  }

  return { code: code.trim() + '\n', appliedRules, warnings }
}

export function formatTransformSummary(result: TransformResult): string[] {
  const lines: string[] = []
  for (const rule of result.appliedRules) {
    lines.push(`✅ ${rule.description}`)
  }
  for (const warning of result.warnings) {
    lines.push(`⚠️  ${warning}`)
  }
  return lines
}
