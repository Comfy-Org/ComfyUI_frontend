import { zComfyNodeDef } from '@comfyorg/object-info-parser'
import { z } from 'zod'

export const CloudNodesEnvelopeSchema = z.record(z.unknown())
export const CloudNodesNodeDefSchema = zComfyNodeDef

export type CloudNodesEnvelope = z.infer<typeof CloudNodesEnvelopeSchema>
