// Classifies which nodes can execute with no hand-authored fixture; the
// rest are recorded with the reason, never silently dropped.
import type { RawNodeDef } from './typePairing'

export type AutoRunClass =
  // Widgets cover every required input and a terminus exists.
  | 'AUTO_RUNNABLE'
  // A required input is a socket; needs wiring (curated workflows).
  | 'NEEDS_WIRES'
  // A required combo has zero options (empty model/file scan).
  | 'NEEDS_MODELS'
  // No outputs and not an OUTPUT_NODE - nothing the executor could watch.
  | 'NO_OBSERVABLE_OUTPUT'

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
    verdict: 'NO_OBSERVABLE_OUTPUT',
    reason: 'no outputs and not an OUTPUT_NODE - nothing observable to queue'
  }
}

export function planAutoRuns(
  defs: Record<string, RawNodeDef & { output_node?: boolean }>,
  packNodeKeys: string[]
): AutoRunVerdict[] {
  return packNodeKeys.map((key) => classifyAutoRunnable(key, defs[key]))
}

// Independent single-node chains per prompt so one bad node fails a batch,
// not the tier.
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
