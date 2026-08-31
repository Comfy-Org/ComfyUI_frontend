/**
 * Drives a pack's real JS twice — original and converted — and records what
 * each run could do.
 *
 * The two runs must be independent. A node type registered by the first run
 * would otherwise still be present for the second, so the converted run could
 * report success it did not earn. `isolate()` snapshots and restores the type
 * registry around each run.
 *
 * Evaluation is injected rather than performed here: in tests that is a
 * synthetic module, and in CI it is the pack's real source. Keeping it out of
 * this module is what makes the battery testable without a corpus.
 */
import { LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { recordDeprecations } from './deprecationRecorder'
import type { Observation, VerificationInput, WireFormat } from './verdict'

/** What the pack is given when it runs. */
interface Sandbox {
  readonly graph: LGraph
}

export type Evaluate = (
  source: string,
  sandbox: Sandbox
) => Promise<void> | void

export interface RunOutcome {
  readonly loaded: boolean
  readonly loadError: string | undefined
  readonly registeredTypes: readonly string[]
  /** Type -> whether `createNode` produced a node. */
  readonly constructed: ReadonlyMap<string, boolean>
  readonly wire: WireFormat | undefined
  readonly deprecations: number
}

/**
 * Restores the global type registry, so runs cannot leak into each other.
 *
 * Must await: a synchronous wrapper around an async body would run its cleanup
 * before the pack had loaded, leaving every registration in place and making
 * the second run see the first run's types as pre-existing.
 */
async function isolate<T>(fn: () => Promise<T>): Promise<T> {
  const snapshot = { ...LiteGraph.registered_node_types }
  try {
    return await fn()
  } finally {
    for (const type of Object.keys(LiteGraph.registered_node_types)) {
      if (!(type in snapshot)) LiteGraph.unregisterNodeType(type)
    }
  }
}

async function runOnce(
  source: string,
  evaluate: Evaluate,
  attribution: string,
  /**
   * Types allowed into the graph used for the wire comparison.
   *
   * Left undefined on the discovery pass. On the comparison pass it is the set
   * that constructed in *both* runs — see `verifyConversion`.
   */
  wireTypes?: ReadonlySet<string>
): Promise<RunOutcome> {
  const before = new Set(Object.keys(LiteGraph.registered_node_types))
  const graph = new LGraph()
  const recorder = recordDeprecations({ attribution })

  let loaded = true
  let loadError: string | undefined
  try {
    await evaluate(source, { graph })
  } catch (error) {
    loaded = false
    loadError = error instanceof Error ? error.message : String(error)
  }

  const registeredTypes = Object.keys(LiteGraph.registered_node_types).filter(
    (t) => !before.has(t)
  )

  // Construction is the sharpest signal available: a constructor that throws
  // takes the whole node type out, and `createNode` reports it as null rather
  // than propagating.
  const constructed = new Map<string, boolean>()
  for (const type of registeredTypes) {
    let node
    try {
      node = LiteGraph.createNode(type)
    } catch {
      node = null
    }
    constructed.set(type, node !== null)
    if (node && (!wireTypes || wireTypes.has(type))) graph.add(node)
  }

  let wire: WireFormat | undefined
  try {
    wire = {
      workflow: JSON.stringify(graph.serialize()),
      // graphToPrompt needs the app; callers that can supply it override this.
      prompt: ''
    }
  } catch {
    wire = undefined
  }

  return {
    loaded,
    loadError,
    registeredTypes,
    constructed,
    wire,
    deprecations: recorder.stop().count
  }
}

export interface VerifyOptions {
  readonly pack: string
  readonly original: string
  readonly converted: string
  readonly evaluate: Evaluate
  /** Substring identifying the pack in stack traces. Defaults to `pack`. */
  readonly attribution?: string
}

/**
 * Runs both sources and reduces them to the input `grade()` expects.
 *
 * Observations are named so a failure reads without cross-referencing:
 * `construct:RgthreeFastMuter` says both what broke and for which type.
 */
export async function verifyConversion(
  options: VerifyOptions
): Promise<VerificationInput & { before: RunOutcome; after: RunOutcome }> {
  const attribution = options.attribution ?? options.pack

  const before = await isolate(() =>
    runOnce(options.original, options.evaluate, attribution)
  )
  const after = await isolate(() =>
    runOnce(options.converted, options.evaluate, attribution)
  )

  // The wire comparison is only meaningful over the same node population.
  //
  // A conversion that fixes construction legitimately produces a graph the
  // original could not: comparing those would report WIRE-CHANGED for every
  // successful fix, burying real regressions in noise. So the comparison runs
  // again over only the types that constructed in *both*, where any difference
  // is attributable to the conversion rather than to the fix.
  const common = new Set(
    [...before.constructed.entries()]
      .filter(([type, ok]) => ok && after.constructed.get(type))
      .map(([type]) => type)
  )

  const wire = common.size
    ? {
        before: (
          await isolate(() =>
            runOnce(options.original, options.evaluate, attribution, common)
          )
        ).wire,
        after: (
          await isolate(() =>
            runOnce(options.converted, options.evaluate, attribution, common)
          )
        ).wire
      }
    : undefined

  const observations: Observation[] = [
    {
      name: 'load',
      before: before.loaded ? 'ok' : 'failed',
      after: after.loaded ? 'ok' : 'failed'
    },
    {
      name: 'register',
      before: before.registeredTypes.length ? 'ok' : 'failed',
      after: after.registeredTypes.length ? 'ok' : 'failed'
    }
  ]

  // Union, so a type that disappeared entirely is reported as a regression
  // rather than quietly dropping out of the comparison.
  const types = new Set([
    ...before.constructed.keys(),
    ...after.constructed.keys()
  ])
  for (const type of [...types].sort()) {
    observations.push({
      name: `construct:${type}`,
      before: before.constructed.get(type) ? 'ok' : 'failed',
      after: after.constructed.get(type) ? 'ok' : 'failed'
    })
  }

  return {
    pack: options.pack,
    observations,
    deprecations: { before: before.deprecations, after: after.deprecations },
    // Absent when no type constructed in both runs, so there is nothing
    // comparable rather than a misleading difference.
    wire:
      wire?.before && wire.after
        ? { before: wire.before, after: wire.after }
        : undefined,
    before,
    after
  }
}
