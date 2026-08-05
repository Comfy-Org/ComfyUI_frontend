/**
 * The Magic Patch conversion contract.
 *
 * One catalog, two consumers: the offline generator applies `rewrite`, and the
 * agent tier is prompted with `guidance` for only the rules that matched. There
 * is deliberately no second source of truth to drift.
 */

/** What a rule found, and what it could do about it. */
export interface Match {
  readonly rule: string
  /** 1-indexed, for reports and review. */
  readonly line: number
  readonly text: string
  /**
   * Why the mechanical tier refused. Absent when the rule rewrote it.
   *
   * Escalation is a first-class outcome: a rule that guesses is worse than one
   * that declines, because a wrong rewrite of working code is invisible until a
   * user hits it.
   */
  readonly escalation?: string
}

import type { Edit } from './edits'

/**
 * What a rule reports. The rule id is injected by `convert`, so a rule cannot
 * misattribute its own findings.
 */
export type Finding = Omit<Match, 'rule'>

export interface ConversionResult {
  /** Full converted text. Convenient locally; not what ships. */
  readonly source: string
  /** The shippable form — see `edits.ts`. */
  readonly edits: readonly Edit[]
  /** Applied mechanically, safe by construction. */
  readonly applied: readonly Match[]
  /** Detected but deliberately not rewritten — the agent's queue. */
  readonly escalated: readonly Match[]
  readonly changed: boolean
}

/**
 * A test emitted alongside a converted artifact.
 *
 * **The same file runs against the original and the converted source**, and is
 * built around that:
 *
 * - `equivalence` — must pass on **both**. This is the load-bearing half: it
 *   asserts the conversion did not change what the code does. A conversion is
 *   only safe to the extent this section is thorough.
 * - `fix` — expected to **fail on the original and pass on the converted**
 *   source. Red-then-green is what proves the test is actually exercising the
 *   changed behaviour rather than passing vacuously.
 *
 * A test that only asserts the fix proves the conversion did *something*; it
 * says nothing about what else it may have broken. Equivalence is the half that
 * makes an artifact trustworthy enough to ship unattended.
 *
 * Three further jobs it does that no other artifact does:
 *
 * 1. **Makes the upstream PR mergeable.** A diff to someone else's pack saying
 *    "trust me" gets ignored; one carrying a red-then-green test gets reviewed.
 * 2. **Makes the conversion durable.** Once merged, the test lives in the
 *    pack's own repo, so the migration cannot be silently reverted later.
 * 3. **Gates the agent tier.** An agent that cannot state an equivalence claim
 *    probably did not understand the code, so a missing one is a rejection.
 */
export interface GeneratedTest {
  readonly filename: string
  readonly source: string
  /** Claims that must hold before **and** after. The safety half. */
  readonly equivalence: readonly string[]
  /** Claims expected to fail before and pass after. The red-green half. */
  readonly fix: readonly string[]
}

/** What a rule needs in order to write a meaningful test. */
export interface TestContext {
  readonly pack: string
  readonly file: string
  /** Node types this file registers, when discoverable. */
  readonly registeredTypes?: readonly string[]
}

export interface MigrationRule {
  readonly id: string
  readonly severity: 'breaking' | 'degraded' | 'deprecated'

  /**
   * True when the rewrite is safe by construction — the transform is provably
   * equivalent by inspection, so no runtime demonstration adds information.
   *
   * Deleting `this.type = this.type ?? undefined` qualifies: it assigns a value
   * to itself. Anything requiring judgement about surrounding intent does not,
   * and agent output never does.
   */
  readonly mechanicallySafe: boolean

  /**
   * The published API this migrates onto, and where the codebase declares it.
   *
   * Required, not optional: a rule that cannot name its destination is out of
   * scope by definition, so the type enforces the scoping decision rather than
   * leaving it to reviewer discipline.
   */
  readonly replacement: { readonly api: string; readonly declaredAt: string }

  /** Markdown injected into the agent prompt when — and only when — this matches. */
  readonly guidance: string

  /**
   * Applies the rule to `lines`, mutating in place. `null` marks a line for
   * deletion, preserving the numbering of every other line so reports stay
   * accurate.
   */
  apply(lines: (string | null)[], report: (m: Finding) => void): void

  /**
   * Emits a test proving this conversion did what it claimed.
   *
   * Optional: a rule that can only be verified by running the whole pack should
   * return `undefined` rather than emit a test that asserts nothing. A vacuous
   * test is worse than none — it reads as coverage while proving nothing.
   */
  generateTest?(
    matches: readonly Match[],
    context: TestContext
  ): GeneratedTest | undefined

  /** Golden cases, executed as tests. A rule that cannot state one is not a rule. */
  readonly cases: readonly {
    readonly name: string
    readonly before: string
    readonly after?: string
    readonly escalates?: boolean
  }[]
}
