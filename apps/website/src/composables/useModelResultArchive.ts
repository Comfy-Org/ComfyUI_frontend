import { onScopeDispose, readonly, ref, watch } from 'vue'
import type { RunOutput } from '../config/workshop-run'
import {
  MODEL_RESULT_LIMITS,
  saveModelResult
} from '../lib/workshop/cinematic-studio/model-results'

interface ArchiveIdentity {
  readonly id: string
  readonly name: string
  readonly modelSlug: string
  readonly createdAt: number
}
interface ArchiveTicket extends ArchiveIdentity {
  readonly namespace: string | undefined
  readonly epoch: number
}

/** Archives only completed outputs. Retrying saves never submits a model request. */
export function useModelResultArchive(namespace: () => string | undefined) {
  const status = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let epoch = 0
  let disposed = false
  let pending:
    | { ticket: ArchiveTicket; outputs: readonly RunOutput[] }
    | undefined
  const current = (ticket: ArchiveTicket) =>
    !disposed && ticket.epoch === epoch && ticket.namespace === namespace()

  watch(
    namespace,
    () => {
      epoch++
      pending = undefined
      status.value = 'idle'
    },
    { flush: 'sync' }
  )
  onScopeDispose(() => {
    disposed = true
    pending = undefined
  })

  function begin(identity: ArchiveIdentity): ArchiveTicket {
    epoch++
    pending = undefined
    status.value = 'idle'
    return { ...identity, namespace: namespace(), epoch }
  }

  async function downloadOutput(output: RunOutput, bytes: number) {
    const url = new URL(output.url)
    if (!['https:', 'http:', 'blob:'].includes(url.protocol))
      throw new Error('Invalid output URL')
    const response = await fetch(output.url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    })
    if (!response.ok) throw new Error('Output unavailable')
    const length = Number(response.headers.get('content-length'))
    if (length > MODEL_RESULT_LIMITS.bytes - bytes)
      throw new Error('Archive too large')
    const blob = await response.blob()
    if (bytes + blob.size > MODEL_RESULT_LIMITS.bytes)
      throw new Error('Archive too large')
    return blob
  }
  async function archive(ticket: ArchiveTicket, outputs: readonly RunOutput[]) {
    const media = outputs.filter(
      (output) => output.purpose !== 'response-metadata'
    )
    if (!ticket.namespace || !media.length) return
    if (current(ticket)) {
      pending = { ticket, outputs: media }
      status.value = 'saving'
    }
    try {
      if (media.length > MODEL_RESULT_LIMITS.outputs)
        throw new Error('Too many outputs')
      const saved = []
      let bytes = 0
      for (const output of media) {
        const blob = await downloadOutput(output, bytes)
        bytes += blob.size
        saved.push({
          kind: output.kind,
          fileName: output.fileName,
          nsfw: !!output.nsfw,
          blob
        })
      }
      await saveModelResult(ticket.namespace, {
        id: ticket.id,
        name: ticket.name,
        modelSlug: ticket.modelSlug,
        createdAt: ticket.createdAt,
        outputs: saved
      })
      if (current(ticket)) {
        status.value = 'saved'
        pending = undefined
      }
    } catch {
      if (current(ticket)) status.value = 'error'
    }
  }

  async function retry() {
    if (!pending || status.value !== 'error' || !current(pending.ticket)) return
    await archive(pending.ticket, pending.outputs)
  }
  return { status: readonly(status), begin, archive, retry }
}
