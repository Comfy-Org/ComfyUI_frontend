import { FROZEN_OPS } from '@comfyorg/comfy-multi-player'
import type { OpBase } from '@comfyorg/comfy-multi-player'
import { z } from 'zod'

const OP_ENVELOPE: Record<keyof OpBase, true> = {
  op_id: true,
  actor: true,
  base_version: true,
  stamp: true
}
export const OP_ENVELOPE_KEYS = Object.keys(OP_ENVELOPE)

export const zGraphOperation = z
  .object({ op: z.enum(FROZEN_OPS) })
  .passthrough()
  .refine(
    (op) => OP_ENVELOPE_KEYS.every((key) => !(key in op)),
    'a recorded op carries the semantic operation only; the wire envelope is minted at replay'
  )
export type RecordedGraphOperation = z.infer<typeof zGraphOperation>
