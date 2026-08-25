import { transformRules, structuralTransforms } from './rules'
import { scrubSecrets } from './scrub'
import { formatInitialFeatureFlags } from '../featureFlags'

interface TransformResult {
  code: string
  appliedRules: { name: string; description: string }[]
  warnings: string[]
  securityFindings: string[]
}

export function transform(
  rawCode: string,
  options: {
    testName?: string
    tags?: string[]
    workflow?: string
    featureFlags?: Record<string, unknown>
  } = {}
): TransformResult {
  const testName = options.testName ?? 'unnamed-test'
  const tags = options.tags ?? ['@canvas']

  const scrubbed = scrubSecrets(rawCode)
  let code = scrubbed.code
  const appliedRules: { name: string; description: string }[] = []
  const warnings: string[] = []

  for (const rule of transformRules) {
    const before = code
    code = code.replace(rule.pattern, rule.replacement)
    if (code !== before) {
      appliedRules.push({ name: rule.name, description: rule.description })
    }
  }

  code = code.replace(/\n{3,}/g, '\n\n')

  for (const structural of structuralTransforms) {
    const before = code
    code = structural.apply(code, testName, tags, options.workflow)
    if (code !== before) {
      appliedRules.push({
        name: structural.name,
        description: structural.description
      })
    }
  }

  if (options.featureFlags && Object.keys(options.featureFlags).length > 0) {
    const featureFlags = formatInitialFeatureFlags(options.featureFlags)
    code = code.replace(
      /\n\n(?=test(?:\.describe|\s*\())/,
      `\n\n${featureFlags}\n\n`
    )
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
  if (!/\btest(?:\.\w+)?\s*\(/.test(code)) {
    warnings.push(
      'No test() call found — paste the whole generated file, not just the recorded statements'
    )
  }
  if (!code.includes('@e2e/fixtures/ComfyPage')) {
    warnings.push(
      'Missing the comfyPage fixture import — paste the whole generated file, including its import line'
    )
  }
  if (/(?<![\w.])page(?![\w.])/.test(code)) {
    warnings.push(
      'A bare `page` reference survived the transform — it is undefined in the generated spec'
    )
  }
  if (!/\bexpect\s*\(/.test(code)) {
    warnings.push(
      'No assertions — the test never proves anything happened, so the commit hook will refuse it. Add a proof step with the assert buttons in the floating toolbar (next to Record) before closing the window.'
    )
  }
  if (/position:\s*\{\s*x:\s*\d+,\s*y:\s*\d+/.test(code)) {
    warnings.push(
      'Contains pixel coordinates — consider replacing with node references (comfyPage.nodeOps.*) where possible'
    )
  }
  if (code.includes('setInputFiles')) {
    warnings.push(
      'Uploads a file from this computer — that file will not exist where tests run. Use an asset from browser_tests/assets/ instead, or add one with comfy-test add-workflow.'
    )
  }

  return {
    code: code.trim() + '\n',
    appliedRules,
    warnings,
    securityFindings: scrubbed.findings
  }
}

export function formatTransformSummary(result: TransformResult): string[] {
  const lines: string[] = []
  for (const rule of result.appliedRules) {
    lines.push(`✅ ${rule.description}`)
  }
  for (const finding of result.securityFindings) {
    lines.push(`🔒 ${finding}`)
  }
  for (const warning of result.warnings) {
    lines.push(`⚠️  ${warning}`)
  }
  return lines
}
