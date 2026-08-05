/**
 * Magic Patch conversion verification.
 *
 * This asks a different question from the ECS compatibility study, and the
 * difference decides the shape of everything here:
 *
 * | | ECS study | Magic Patch |
 * |---|---|---|
 * | Compares | one source, two frontend branches | two sources, one frontend |
 * | Asks | "did ECS change behaviour?" | "is the conversion safe and did it work?" |
 * | Wants | identical | **not** identical — the whole point is that broken becomes working |
 *
 * So "behaviour is identical" is the wrong invariant. A conversion that fixes
 * rgthree's virtual nodes *must* differ from the original, because the original
 * throws. The invariants that actually hold are narrower and stated below.
 */

/** One observed capability of a pack, before and after conversion. */
export interface Observation {
  /** e.g. 'load', 'register', 'construct:RgthreeFastMuter', 'serialize'. */
  readonly name: string
  readonly before: 'ok' | 'failed'
  readonly after: 'ok' | 'failed'
}

export interface WireFormat {
  /** `graphToPrompt` output. The hard gate. */
  readonly prompt: string
  /** Serialized workflow JSON. */
  readonly workflow: string
}

export interface VerificationInput {
  readonly pack: string
  readonly observations: readonly Observation[]
  /**
   * Deprecation warnings attributed to this pack's own frames.
   *
   * A zero *after* only means something if the baseline was non-zero: zero-to-
   * zero proves the battery never reached the code, not that it was converted.
   */
  readonly deprecations: { readonly before: number; readonly after: number }
  /** Absent when the pack could not produce output at all before conversion. */
  readonly wire?: { readonly before: WireFormat; readonly after: WireFormat }
}

export type Verdict =
  /** Something that worked before now fails. Blocks the artifact. */
  | 'REGRESSED'
  /** Wire format changed. Blocks the artifact. */
  | 'WIRE-CHANGED'
  /** Something broken now works, nothing regressed. Ship it. */
  | 'IMPROVED'
  /** Nothing changed observably, but deprecations were retired. Ship it. */
  | 'CLEANED'
  /** No observable difference and no deprecations retired. Suspect coverage. */
  | 'NO-SIGNAL'

export interface VerificationResult {
  readonly pack: string
  readonly verdict: Verdict
  readonly shippable: boolean
  readonly fixed: readonly string[]
  readonly broken: readonly string[]
  readonly notes: readonly string[]
}

/**
 * Grades one pack's conversion.
 *
 * Ordering matters: regressions and wire changes are disqualifying and are
 * checked first, so a conversion can never be waved through because it also
 * fixed something.
 */
export function grade(input: VerificationInput): VerificationResult {
  const broken = input.observations
    .filter((o) => o.before === 'ok' && o.after === 'failed')
    .map((o) => o.name)
  const fixed = input.observations
    .filter((o) => o.before === 'failed' && o.after === 'ok')
    .map((o) => o.name)
  const notes: string[] = []

  if (broken.length) {
    return {
      pack: input.pack,
      verdict: 'REGRESSED',
      shippable: false,
      fixed,
      broken,
      notes: [`Conversion broke: ${broken.join(', ')}.`]
    }
  }

  if (input.wire) {
    const { before, after } = input.wire
    if (before.prompt !== after.prompt) {
      return {
        pack: input.pack,
        verdict: 'WIRE-CHANGED',
        shippable: false,
        fixed,
        broken,
        notes: [
          'graphToPrompt output changed. This is the hard gate: the frontend’s contract with the backend must be byte-identical.'
        ]
      }
    }
    if (before.workflow !== after.workflow) {
      return {
        pack: input.pack,
        verdict: 'WIRE-CHANGED',
        shippable: false,
        fixed,
        broken,
        notes: [
          'Serialized workflow changed. Most often a reconnect that allocated new link ids — use moveLinksTo to preserve them.'
        ]
      }
    }
  }

  const { before: depsBefore, after: depsAfter } = input.deprecations
  if (depsAfter > 0) {
    notes.push(
      `${depsAfter} deprecation warning(s) still attributed to this pack; conversion is incomplete.`
    )
  }

  if (fixed.length) {
    return {
      pack: input.pack,
      verdict: 'IMPROVED',
      shippable: true,
      fixed,
      broken,
      notes
    }
  }

  if (depsBefore > 0 && depsAfter === 0) {
    return {
      pack: input.pack,
      verdict: 'CLEANED',
      shippable: true,
      fixed,
      broken,
      notes
    }
  }

  // The coverage trap, made explicit rather than reported as success.
  notes.push(
    depsBefore === 0
      ? 'Baseline had zero deprecations, so a zero result proves nothing — the battery may never reach the converted code. Add a targeted probe before trusting this rule.'
      : 'No observable change and no deprecations retired.'
  )
  return {
    pack: input.pack,
    verdict: 'NO-SIGNAL',
    shippable: false,
    fixed,
    broken,
    notes
  }
}
