import { transformRules, structuralTransforms } from './rules'

interface TransformResult {
  code: string
  appliedRules: { name: string; description: string }[]
  warnings: string[]
}

/**
 * Transform raw Playwright codegen output into ComfyUI conventions.
 */
export function transform(
  rawCode: string,
  options: {
    testName?: string
    tags?: string[]
  } = {}
): TransformResult {
  const testName = options.testName ?? 'unnamed-test'
  const tags = options.tags ?? ['@canvas']

  let code = rawCode
  const appliedRules: { name: string; description: string }[] = []
  const warnings: string[] = []

  // Phase 1: Apply regex-based rules
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

  // Phase 2: Clean up empty lines from removed statements
  code = code.replace(/\n{3,}/g, '\n\n')

  // Phase 3: Apply structural transforms
  for (const transform of structuralTransforms) {
    const before = code
    code = transform.apply(code, testName, tags)
    if (code !== before) {
      appliedRules.push({
        name: transform.name,
        description: transform.description
      })
    }
  }

  // Phase 4: Check for remaining issues and warn
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
      'Still imports from @playwright/test — should use ../fixtures/ComfyPage'
    )
  }
  if (/position:\s*\{\s*x:\s*\d+,\s*y:\s*\d+/.test(code)) {
    warnings.push(
      'Contains pixel coordinates — consider replacing with node references (comfyPage.nodeOps.*) where possible'
    )
  }

  return { code: code.trim() + '\n', appliedRules, warnings }
}

/**
 * Get a human-readable summary of what was transformed.
 */
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
