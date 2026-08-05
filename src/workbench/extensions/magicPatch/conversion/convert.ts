/**
 * Applies the rule catalog to one file.
 *
 * Runs in CI over the corpus, and in the browser for packs with no precomputed
 * artifact — one implementation, so the two can never disagree about what a
 * conversion means.
 */
import { deriveEdits } from './edits'
import { RULES } from './rules'
import type {
  ConversionResult,
  GeneratedTest,
  Match,
  MigrationRule,
  TestContext
} from './types'

export function convert(
  source: string,
  rules: readonly MigrationRule[] = RULES
): ConversionResult {
  // `null` marks a deleted line rather than splicing, so every later match
  // still reports its original line number.
  const lines: (string | null)[] = source.split('\n')
  const applied: Match[] = []
  const escalated: Match[] = []

  for (const rule of rules) {
    // The id is stamped here, not by the rule, so findings are always
    // attributed to the rule that actually produced them.
    rule.apply(lines, (finding) => {
      const match: Match = { ...finding, rule: rule.id }
      ;(match.escalation ? escalated : applied).push(match)
    })
  }

  return {
    source: lines.filter((l): l is string => l !== null).join('\n'),
    // The shippable representation. `source` is convenient for tests and for
    // driving the runner; `edits` is what a manifest stores.
    edits: deriveEdits(source, lines),
    applied,
    escalated,
    changed: applied.length > 0
  }
}

/**
 * Emits the tests for every rule that both matched and can prove its own work.
 *
 * Rules that can only be verified by running the whole pack return nothing,
 * rather than emitting a test that asserts something trivially true.
 */
export function generateTests(
  result: ConversionResult,
  context: TestContext,
  rules: readonly MigrationRule[] = RULES
): readonly GeneratedTest[] {
  const byRule = new Map<string, Match[]>()
  for (const match of result.applied) {
    byRule.set(match.rule, [...(byRule.get(match.rule) ?? []), match])
  }

  return rules.flatMap((rule) => {
    const matches = byRule.get(rule.id)
    if (!matches || !rule.generateTest) return []
    const test = rule.generateTest(matches, context)
    return test ? [test] : []
  })
}

/**
 * How much we know about a conversion, so the caller can set policy rather than
 * having one baked in here.
 *
 * - `proven` — every applied rule is safe by construction. A runtime
 *   demonstration would add no information, so not having one is not a defect.
 * - `demonstrated` — a test exercises the change.
 * - `unverified` — code changed, the change is not provably safe, and nothing
 *   demonstrates it. This is the only genuinely alarming state, and it is where
 *   agent output lands by default.
 */
export type Confidence = 'proven' | 'demonstrated' | 'unverified'

export interface Assessment {
  readonly confidence: Confidence
  readonly reasons: readonly string[]
}

export function assess(
  result: ConversionResult,
  tests: readonly GeneratedTest[],
  rules: readonly MigrationRule[] = RULES
): Assessment {
  const reasons: string[] = []
  if (!result.changed) {
    return { confidence: 'proven', reasons: ['Nothing was converted.'] }
  }

  const byId = new Map(rules.map((r) => [r.id, r]))
  const risky = [...new Set(result.applied.map((m) => m.rule))].filter(
    (id) => !byId.get(id)?.mechanicallySafe
  )

  if (tests.length) {
    reasons.push(
      `${tests.length} test(s) generated; ${tests.reduce((n, t) => n + t.equivalence.length, 0)} equivalence claim(s).`
    )
    return { confidence: 'demonstrated', reasons }
  }

  if (!risky.length) {
    reasons.push(
      'All applied rules are safe by construction, so no runtime demonstration is required.'
    )
    return { confidence: 'proven', reasons }
  }

  reasons.push(
    `Rules requiring judgement were applied without a demonstration: ${risky.join(', ')}.`
  )
  return { confidence: 'unverified', reasons }
}

/**
 * The guidance for exactly the rules that matched.
 *
 * Targeted context is the main lever on agent reliability: a file hitting two
 * rules should see two rules, not the whole catalog.
 */
export function guidanceFor(
  matches: readonly Match[],
  rules: readonly MigrationRule[] = RULES
): string {
  const hit = new Set(matches.map((m) => m.rule))
  return rules
    .filter((r) => hit.has(r.id))
    .map((r) => `## ${r.id}\n\n${r.guidance}`)
    .join('\n\n')
}
