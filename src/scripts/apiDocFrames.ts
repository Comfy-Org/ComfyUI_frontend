import type { Op } from '@comfyorg/comfy-multi-player'
import type { DocOpsResultData } from '@comfyorg/ingest-types'

export type DocOp = Pick<Op, 'op_id' | 'actor'> & Record<string, unknown>

type DocIdentity = Pick<DocOpsResultData, 'v' | 'workflow_id'>

export type PendingIngestClientDocFrame =
  | {
      type: 'doc_subscribe'
      data: DocIdentity & {
        state_vector_b64: string
        supports_reseed: boolean
      }
    }
  | { type: 'doc_unsubscribe'; data: DocIdentity }
  | {
      type: 'doc_ops'
      data: DocIdentity & { tab: string; ops: readonly DocOp[] }
    }
  | {
      type: 'doc_reseed'
      data: DocIdentity & {
        expected_seq: number
        workflow: Record<string, unknown>
      }
    }
