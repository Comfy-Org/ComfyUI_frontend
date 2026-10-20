import type { ReshootRunPhase } from '@/lib/workshop/cinematic-studio/reshoot-engine/run'
import {
  downloadOutput,
  runJob
} from '@/lib/workshop/cinematic-studio/reshoot-engine/run'
import type { ReshootTransport } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import type { SwapRequest } from './workflow'
import { swapWorkflow } from './workflow'

/** Where a run stands, from the first byte sent to the last byte fetched. */
export type SwapPhase = 'uploading' | ReshootRunPhase | 'fetching'

/** One swap to run: the two files, and everything else the graph is told. */
export interface SwapJob {
  readonly video: File
  readonly character: File
  /** Makes the first-frame anchor; a failure runs the swap without one. */
  readonly makeAnchor?: (signal: AbortSignal) => Promise<File>
  readonly request: Omit<SwapRequest, 'video' | 'character' | 'anchor'>
}

/**
 * Sends each file once: bytes already sent keep their name, so a retake
 * uploads nothing twice. A failed upload is forgotten and tried again.
 */
export function uploadOnce(transport: ReshootTransport) {
  const sent = new WeakMap<File, Promise<string>>()
  return (file: File, signal: AbortSignal): Promise<string> => {
    const known = sent.get(file)
    if (known) return known
    const sending = transport.upload(file, signal)
    sent.set(file, sending)
    sending.catch(() => sent.delete(file))
    return sending
  }
}

/**
 * The one path every backend goes through: upload both files, submit the
 * graph, wait for it, and fetch the result. Throws what the transport throws.
 */
export async function runSwap(
  transport: ReshootTransport,
  upload: (file: File, signal: AbortSignal) => Promise<string>,
  job: SwapJob,
  onPhase: (phase: SwapPhase) => void,
  signal: AbortSignal
): Promise<Blob> {
  const [video, character, anchor] = await Promise.all([
    upload(job.video, signal),
    upload(job.character, signal),
    anchorFor(job, upload, signal)
  ])
  const finished = await runJob(
    transport,
    swapWorkflow({ ...job.request, video, character, anchor }),
    onPhase,
    signal
  )
  onPhase('fetching')
  return downloadOutput(transport, finished, 'result', signal)
}

async function anchorFor(
  job: SwapJob,
  upload: (file: File, signal: AbortSignal) => Promise<string>,
  signal: AbortSignal
): Promise<string | undefined> {
  if (!job.makeAnchor) return undefined
  try {
    return await upload(await job.makeAnchor(signal), signal)
  } catch (error) {
    if (signal.aborted) throw error
    return undefined
  }
}
