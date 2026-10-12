import type {
  DocOpsResultData,
  DocResetData,
  DocUpdateData,
  ServerDocFrame as IngestServerDocFrame
} from '@comfyorg/ingest-types'
import {
  zDocOpsResultData,
  zDocOpsResultFrame,
  zDocResetData,
  zDocResetFrame,
  zDocUpdateData,
  zDocUpdateFrame
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyApi } from '@/scripts/api'
import type { DocOp, PendingIngestClientDocFrame } from '@/scripts/apiDocFrames'

import { wireLog } from './crdtLog'

export type { DocOpFailure } from '@comfyorg/ingest-types'
export type { DocOp } from '@/scripts/apiDocFrames'

export const DOC_PROTOCOL_VERSION = 1
const utf8 = new TextEncoder()

function boundedUtf8(value: string, bytes: number): boolean {
  return value.length <= bytes && utf8.encode(value).length <= bytes
}

const workflowId = zDocUpdateData.shape.workflow_id.refine((value) =>
  boundedUtf8(value, 128)
)
const actor = zDocUpdateData.shape.actor
  .unwrap()
  .refine((value) => boundedUtf8(value, 256))
const sequence = z
  .unknown()
  .refine(
    (value): boolean => typeof value === 'number' || typeof value === 'bigint'
  )
  .pipe(zDocUpdateData.shape.seq)
  .refine((value) => value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER))
  .transform(Number)
const code = zDocOpsResultData.shape.code
  .unwrap()
  .refine((value) => boundedUtf8(value, 128))
const message = zDocOpsResultData.shape.message
  .unwrap()
  .refine((value) => boundedUtf8(value, 8 << 10))
const opId = zDocUpdateData.shape.op_ids
  .unwrap()
  .element.refine((value) => boundedUtf8(value, 128))
const opIds = z.array(opId).refine((value) => value.length <= 256)
const common = { workflow_id: workflowId }
const resultMetadata = {
  ...common,
  seq: sequence.optional(),
  code: code.optional(),
  message: message.optional()
}

const pendingIngestDocSubscribed = zDocOpsResultData
  .pick({
    v: true,
    workflow_id: true,
    ok: true,
    seq: true,
    code: true,
    message: true
  })
  .extend({ ...resultMetadata, expected_seq: sequence.optional() })
const pendingIngestDocReseedResult = pendingIngestDocSubscribed
  .omit({ expected_seq: true })
  .extend({ outcome: code.optional() })
const pendingIngestAwareness = z.object({
  v: zDocUpdateData.shape.v,
  ...common,
  actor,
  state: z
    .record(z.string(), z.unknown())
    .refine((value) => {
      try {
        return boundedUtf8(JSON.stringify(value), 8 << 10)
      } catch {
        return false
      }
    })
    .optional(),
  expires_at: sequence.optional()
})

const serverDocFrame = z.discriminatedUnion('type', [
  zDocUpdateFrame.extend({
    data: zDocUpdateData.extend({
      ...common,
      seq: sequence,
      lineage_seq: sequence,
      actor: actor.optional(),
      op_ids: opIds.optional(),
      update_b64: zDocUpdateData.shape.update_b64
        .refine((value) => value.length <= 8 << 20)
        .pipe(z.base64().min(1))
        .pipe(
          z.string().refine((value) => {
            const tail = value.slice(-4)
            return btoa(atob(tail)) === tail
          })
        )
    })
  }),
  zDocResetFrame.extend({
    data: zDocResetData.extend({
      ...common,
      seq: sequence,
      lineage_seq: sequence,
      actor: actor.optional()
    })
  }),
  zDocOpsResultFrame.extend({
    data: zDocOpsResultData.extend({
      ...resultMetadata,
      applied: opIds.optional(),
      skipped: opIds.optional(),
      failed: zDocOpsResultData.shape.failed
        .unwrap()
        .extend({
          op_id: opId.optional(),
          code,
          message
        })
        .optional()
    })
  }),
  z.object({
    type: z.enum(['doc_subscribed']),
    data: pendingIngestDocSubscribed
  }),
  z.object({
    type: z.enum(['doc_reseed_result']),
    data: pendingIngestDocReseedResult
  }),
  z.object({ type: z.enum(['awareness']), data: pendingIngestAwareness })
])

type WithWorkflowId<T extends { workflow_id: string }> = Omit<
  T,
  'v' | 'workflow_id'
> & { workflowId: T['workflow_id'] }

export type DocUpdate = WithWorkflowId<
  Pick<DocUpdateData, 'workflow_id' | 'seq' | 'actor'>
> & {
  update: Uint8Array
  opIds?: DocUpdateData['op_ids']
}
export type DocReset = WithWorkflowId<Omit<DocResetData, 'lineage_seq'>> & {
  lineageSeq: DocResetData['lineage_seq']
}
export type DocOpsResult = WithWorkflowId<DocOpsResultData> &
  Required<Pick<DocOpsResultData, 'applied' | 'skipped'>>
export type DocSubscribed = WithWorkflowId<
  Omit<z.output<typeof pendingIngestDocSubscribed>, 'expected_seq'>
> & {
  expectedSeq?: z.output<typeof pendingIngestDocSubscribed>['expected_seq']
}
export type DocReseedResult = WithWorkflowId<
  z.output<typeof pendingIngestDocReseedResult>
>
type DocAwareness = WithWorkflowId<
  Omit<z.output<typeof pendingIngestAwareness>, 'expires_at'>
> & {
  expiresAt?: number
}
type DocFrameData = {
  doc_update: DocUpdate
  doc_reset: DocReset
  doc_ops_result: DocOpsResult
  doc_subscribed: DocSubscribed
  doc_reseed_result: DocReseedResult
  awareness: DocAwareness
}
type FrameType =
  | IngestServerDocFrame['type']
  | 'doc_subscribed'
  | 'doc_reseed_result'
  | 'awareness'
export type DecodedServerDocFrame = {
  [K in FrameType]: { type: K; data: DocFrameData[K] }
}[FrameType]
export type DocFrameTransport = Pick<
  ComfyApi,
  'sendDocFrame' | 'registerFrameHandler'
>

export function encodeBase64(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function parseServerDocFrame(
  value: unknown
): DecodedServerDocFrame | null {
  const parsed = serverDocFrame.safeParse(value)
  if (!parsed.success) return null
  const frame = parsed.data
  switch (frame.type) {
    case 'doc_update': {
      const { workflow_id, seq, actor, op_ids, update_b64 } = frame.data
      return {
        type: frame.type,
        data: {
          workflowId: workflow_id,
          seq,
          actor,
          opIds: op_ids,
          update: Uint8Array.from(atob(update_b64), (char) =>
            char.charCodeAt(0)
          )
        }
      }
    }
    case 'doc_reset': {
      const { v, workflow_id, lineage_seq, ...data } = frame.data
      return {
        type: frame.type,
        data: { ...data, workflowId: workflow_id, lineageSeq: lineage_seq }
      }
    }
    case 'doc_ops_result': {
      const { v, workflow_id, ...data } = frame.data
      return {
        type: frame.type,
        data: {
          ...data,
          workflowId: workflow_id,
          applied: data.applied ?? [],
          skipped: data.skipped ?? []
        }
      }
    }
    case 'doc_subscribed': {
      const { v, workflow_id, expected_seq, ...data } = frame.data
      return {
        type: frame.type,
        data: {
          ...data,
          workflowId: workflow_id,
          ...(expected_seq !== undefined && { expectedSeq: expected_seq })
        }
      }
    }
    case 'doc_reseed_result': {
      const { v, workflow_id, ...data } = frame.data
      return { type: frame.type, data: { ...data, workflowId: workflow_id } }
    }
    case 'awareness': {
      const { v, workflow_id, expires_at, ...data } = frame.data
      return {
        type: frame.type,
        data: { ...data, workflowId: workflow_id, expiresAt: expires_at }
      }
    }
  }
}

export class DocFrameClient extends EventTarget {
  private readonly unregister: (() => void)[] = []

  constructor(private readonly transport: DocFrameTransport) {
    super()
    const reportedTypes = new Set<string>()
    for (const type of serverDocFrame.options.flatMap(
      (schema) => schema.shape.type.options
    )) {
      this.unregister.push(
        transport.registerFrameHandler(type, (data) => {
          const parsed = parseServerDocFrame({ type, data })
          if (parsed) {
            this.dispatchEvent(new CustomEvent(type, { detail: parsed.data }))
            return
          }
          if (reportedTypes.has(type)) return
          reportedTypes.add(type)
          reportError(new Error('Discarded invalid server document frame'), {
            surface: 'agent',
            errorType: 'agent_crdt_invalid_server_frame',
            tags: { frame_type: type },
            level: 'warning'
          })
        })
      )
    }
  }

  subscribe(workflowId: string, stateVector: Uint8Array): boolean {
    return this.send({
      type: 'doc_subscribe',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: workflowId,
        state_vector_b64: encodeBase64(stateVector),
        supports_reseed: true
      }
    })
  }

  reseed(
    workflowId: string,
    expectedSeq: number,
    workflow: Record<string, unknown>
  ): boolean {
    return this.send({
      type: 'doc_reseed',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: workflowId,
        expected_seq: expectedSeq,
        workflow
      }
    })
  }

  unsubscribe(workflowId: string): boolean {
    return this.send({
      type: 'doc_unsubscribe',
      data: { v: DOC_PROTOCOL_VERSION, workflow_id: workflowId }
    })
  }

  sendOps(workflowId: string, tab: string, ops: readonly DocOp[]): boolean {
    return this.send({
      type: 'doc_ops',
      data: { v: DOC_PROTOCOL_VERSION, workflow_id: workflowId, tab, ops }
    })
  }

  destroy(): void {
    for (const unregister of this.unregister) unregister()
    this.unregister.length = 0
  }

  private send(frame: PendingIngestClientDocFrame): boolean {
    const delivered = this.transport.sendDocFrame(frame)
    wireLog.trace('ws_out', 'outbound frame', { delivered, frame })
    return delivered
  }
}
