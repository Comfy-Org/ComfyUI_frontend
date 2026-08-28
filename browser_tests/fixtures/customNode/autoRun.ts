// Classifies which nodes can execute with no hand-authored fixture; the
// rest are recorded with the reason, never silently dropped.
import { chunk } from 'es-toolkit'

import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'

type AutoRunClass =
  // Widgets cover every required input and a terminus exists.
  | 'AUTO_RUNNABLE'
  // Every required socket is synthesizable from a model-free producer.
  | 'CHAINABLE'
  // A required socket type has no model-free producer (MODEL, CLIP, SEGS...).
  | 'NEEDS_WIRES'
  // A required combo has zero options (empty model/file scan).
  | 'NEEDS_MODELS'
  // No outputs and not an OUTPUT_NODE - nothing the executor could watch.
  | 'NO_OBSERVABLE_OUTPUT'

export interface RequiredSocket {
  name: string
  type: string
}

export interface AutoRunVerdict {
  key: string
  verdict: AutoRunClass
  // Wire output 0 to PreviewAny (false = the node is its own terminus).
  needsPreviewSink?: boolean
  // CHAINABLE: sockets to satisfy from SYNTH_PRODUCERS, in declaration order.
  requiredSockets?: RequiredSocket[]
  reason: string
}

// Model-free producers for each synthesizable socket type. NUMBER is a WAS
// type with a WAS producer, so each entry is validated against the live defs
// before it counts as synthesizable.
export const SYNTH_PRODUCERS: Record<
  string,
  { nodeType: string; outputIndex: number }
> = {
  IMAGE: { nodeType: 'EmptyImage', outputIndex: 0 },
  LATENT: { nodeType: 'EmptyLatentImage', outputIndex: 0 },
  MASK: { nodeType: 'SolidMask', outputIndex: 0 },
  INT: { nodeType: 'PrimitiveInt', outputIndex: 0 },
  FLOAT: { nodeType: 'PrimitiveFloat', outputIndex: 0 },
  STRING: { nodeType: 'PrimitiveString', outputIndex: 0 },
  BOOLEAN: { nodeType: 'PrimitiveBoolean', outputIndex: 0 },
  AUDIO: { nodeType: 'EmptyAudio', outputIndex: 0 },
  NUMBER: { nodeType: 'Constant Number', outputIndex: 0 },
  '*': { nodeType: 'PrimitiveInt', outputIndex: 0 }
}

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN'])

function classifyInput(spec: unknown): 'widget' | 'socket' | 'empty-combo' {
  const specArray: unknown[] = Array.isArray(spec) ? spec : [spec]
  const rawType = specArray[0]
  const options = specArray[1] as
    | { forceInput?: boolean; options?: unknown; widgetType?: string }
    | undefined
  // forceInput beats every form, combos included: no widget materializes,
  // so no default exists to run on - the input must be wired.
  if (options?.forceInput) return 'socket'
  if (Array.isArray(rawType))
    return rawType.length > 0 ? 'widget' : 'empty-combo'
  if (typeof rawType !== 'string') return 'socket'
  if (rawType === 'COMBO') {
    // Transformed (V2-schema) defs carry combos as the literal 'COMBO' with
    // the option list in the opts object. No static list (empty, or a
    // `remote` lazy combo) means the default value cannot be verified
    // runnable at plan time - same bucket as an empty model scan.
    return Array.isArray(options?.options) && options.options.length > 0
      ? 'widget'
      : 'empty-combo'
  }
  return options?.widgetType !== undefined || WIDGET_TYPES.has(rawType)
    ? 'widget'
    : 'socket'
}

function socketType(spec: unknown): string {
  const specArray: unknown[] = Array.isArray(spec) ? spec : [spec]
  return String(specArray[0])
}

export function classifyAutoRunnable(
  key: string,
  def: RawNodeDef & { output_node?: boolean },
  synthTypes: ReadonlySet<string>
): AutoRunVerdict {
  const sockets: RequiredSocket[] = []
  for (const [name, spec] of Object.entries(def.input?.required ?? {})) {
    const kind = classifyInput(spec)
    if (kind === 'empty-combo')
      return {
        key,
        verdict: 'NEEDS_MODELS',
        reason: `required combo "${name}" has no options on this backend`
      }
    if (kind === 'socket') {
      const type = socketType(spec)
      // Union-typed sockets ("IMAGE,MASK") accept any member (same semantics
      // isTypeCompatible applies in typePairing), so one synthesizable member
      // makes the socket wireable. Push the MEMBER, not the union string -
      // the chain builder synthesizes a producer for exactly this type.
      const member = type
        .split(',')
        .map((candidate) => candidate.trim())
        .find((candidate) => synthTypes.has(candidate))
      if (member === undefined)
        return {
          key,
          verdict: 'NEEDS_WIRES',
          reason: `required input "${name}" (${type}) has no model-free producer`
        }
      sockets.push({ name, type: member })
    }
  }
  const terminus =
    def.output_node === true
      ? { needsPreviewSink: false, note: 'node is its own terminus' }
      : (def.output ?? []).length > 0
        ? { needsPreviewSink: true, note: 'output 0 -> PreviewAny' }
        : null
  if (!terminus)
    return {
      key,
      verdict: 'NO_OBSERVABLE_OUTPUT',
      reason: 'no outputs and not an OUTPUT_NODE - nothing observable to queue'
    }
  if (sockets.length === 0)
    return {
      key,
      verdict: 'AUTO_RUNNABLE',
      needsPreviewSink: terminus.needsPreviewSink,
      reason: `widgets satisfy all required inputs; ${terminus.note}`
    }
  return {
    key,
    verdict: 'CHAINABLE',
    needsPreviewSink: terminus.needsPreviewSink,
    requiredSockets: sockets,
    reason: `${sockets.length} required socket(s) synthesized from model-free producers; ${terminus.note}`
  }
}

export function planAutoRuns(
  defs: Record<string, RawNodeDef & { output_node?: boolean }>,
  packNodeKeys: string[]
): AutoRunVerdict[] {
  // A producer only counts if the backend actually registers it.
  const synthTypes = new Set(
    Object.entries(SYNTH_PRODUCERS)
      .filter(([, producer]) => producer.nodeType in defs)
      .map(([type]) => type)
  )
  return packNodeKeys.map((key) =>
    classifyAutoRunnable(key, defs[key], synthTypes)
  )
}

// Independent chains per prompt so one bad node fails a batch, not the tier.
export function batchAutoRunnable(
  verdicts: AutoRunVerdict[],
  batchSize: number
): AutoRunVerdict[][] {
  const runnable = verdicts.filter(
    (verdict) =>
      verdict.verdict === 'AUTO_RUNNABLE' || verdict.verdict === 'CHAINABLE'
  )
  return chunk(runnable, batchSize)
}

export const AUTO_RUN_WIDGET_INPUTS: Record<
  string,
  Record<string, Record<string, string>>
> = {
  'ComfyUI-Impact-Pack': {
    ImageReceiver: { image: '000_custom_node_probe.webp' }
  },
  'ComfyUI-VideoHelperSuite': {
    VHS_LoadAudio: { audio_file: 'input/plain_audio.wav' },
    VHS_LoadAudioUpload: { audio: 'plain_audio.wav' },
    VHS_LoadImagePath: { image: 'input/test_upload_image.webp' },
    VHS_LoadImages: { directory: 'images' },
    VHS_LoadImagesPath: { directory: 'input/images' },
    VHS_LoadVideoFFmpegPath: { video: 'input/plain_video.mp4' },
    VHS_LoadVideoPath: { video: 'input/plain_video.mp4' }
  }
}

export const CLOUD_RUN_EXCLUSIONS: Record<
  string,
  Record<string, { reason: string; restore: string }>
> = {
  'ComfyUI-VideoHelperSuite': {
    VHS_SelectLatest: {
      reason:
        'its Python execute method is deliberately unreachable and requires pack JS to replace the node during prompt conversion',
      restore:
        'add a curated prompt-conversion fixture for VHS_SelectLatest and remove this entry when the transformed workflow executes'
    }
  }
}
