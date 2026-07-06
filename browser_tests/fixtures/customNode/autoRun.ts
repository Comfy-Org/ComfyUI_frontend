// Classifies which registered nodes can execute with zero hand-authored
// fixtures: every required input satisfiable by a widget default, plus an
// observable terminus (the node is an OUTPUT_NODE, or an output we can wire
// to core PreviewAny). Those run for real on the backend; the rest are
// recorded with the reason they cannot run alone - never silently dropped.
import type { RawNodeDef } from './typePairing'

export type AutoRunClass =
  // Runs alone: widgets cover every required input, terminus available.
  | 'AUTO_RUNNABLE'
  // A required input is a socket (custom type or forceInput); execution
  // needs wiring, which the curated run workflows cover instead.
  | 'NEEDS_WIRES'
  // A required combo has zero options on this backend - a model/file scan
  // came back empty, so no valid default exists (CPU gate has no models).
  | 'NEEDS_MODELS'
  // Widgets suffice but nothing observable to queue: no outputs and not an
  // OUTPUT_NODE, so the executor would never touch it.
  | 'NO_SINK'

export interface AutoRunVerdict {
  key: string
  verdict: AutoRunClass
  // Set for AUTO_RUNNABLE: wire output 0 to PreviewAny (false = the node is
  // its own OUTPUT_NODE terminus and runs standalone).
  needsPreviewSink?: boolean
  reason: string
}

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN'])

type InputSpec = [unknown, Record<string, unknown>?] | unknown

function classifyInput(
  name: string,
  spec: InputSpec
): 'widget' | 'socket' | 'empty-combo' {
  const specArray = Array.isArray(spec) ? spec : [spec]
  const rawType = specArray[0]
  const options = specArray[1] as { forceInput?: boolean } | undefined
  if (Array.isArray(rawType))
    return rawType.length > 0 ? 'widget' : 'empty-combo'
  if (typeof rawType !== 'string') return 'socket'
  if (options?.forceInput) return 'socket'
  return WIDGET_TYPES.has(rawType) ? 'widget' : 'socket'
}

export function classifyAutoRunnable(
  key: string,
  def: RawNodeDef & { output_node?: boolean }
): AutoRunVerdict {
  for (const [name, spec] of Object.entries(def.input?.required ?? {})) {
    const kind = classifyInput(name, spec)
    if (kind === 'socket')
      return {
        key,
        verdict: 'NEEDS_WIRES',
        reason: `required input "${name}" is a socket`
      }
    if (kind === 'empty-combo')
      return {
        key,
        verdict: 'NEEDS_MODELS',
        reason: `required combo "${name}" has no options on this backend`
      }
  }
  if (def.output_node === true)
    return {
      key,
      verdict: 'AUTO_RUNNABLE',
      needsPreviewSink: false,
      reason: 'widgets satisfy all required inputs; node is its own terminus'
    }
  if ((def.output ?? []).length > 0)
    return {
      key,
      verdict: 'AUTO_RUNNABLE',
      needsPreviewSink: true,
      reason: 'widgets satisfy all required inputs; output 0 -> PreviewAny'
    }
  return {
    key,
    verdict: 'NO_SINK',
    reason: 'no outputs and not an OUTPUT_NODE - nothing observable to queue'
  }
}

export function planAutoRuns(
  defs: Record<string, RawNodeDef & { output_node?: boolean }>,
  packNodeKeys: string[]
): AutoRunVerdict[] {
  return packNodeKeys.map((key) => classifyAutoRunnable(key, defs[key]))
}

// Independent single-node chains per prompt; one bad node fails its batch,
// not the whole tier, and the executed-set check still attributes per node.
export function batchAutoRunnable(
  verdicts: AutoRunVerdict[],
  batchSize: number
): AutoRunVerdict[][] {
  const runnable = verdicts.filter(
    (verdict) => verdict.verdict === 'AUTO_RUNNABLE'
  )
  const batches: AutoRunVerdict[][] = []
  for (let offset = 0; offset < runnable.length; offset += batchSize)
    batches.push(runnable.slice(offset, offset + batchSize))
  return batches
}
