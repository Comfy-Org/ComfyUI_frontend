import { z } from 'zod'

export const CloudNodesEnvelopeSchema = z.record(z.string(), z.unknown())
