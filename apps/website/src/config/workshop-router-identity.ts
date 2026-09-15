import { z } from 'astro/zod'

const modelId = z.string().regex(/^[\w.-]+\/[\w.-]+$/)
const nativeDefaults = z.record(z.string(), z.json())
const match = z.object({
  routerId: modelId,
  nativeDefaults: nativeDefaults.optional(),
  condition: z.string().min(1).optional()
})

export const workshopIdentityAuditSchema = z.object({
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  records: z.array(
    z.object({
      legacyId: modelId,
      status: z.enum(['verified', 'ambiguous', 'unavailable']),
      matches: z.array(match),
      reason: z.string().min(1),
      evidence: z.array(z.string().min(1)).min(1),
      contentIssue: z.literal('wrong-model-media').optional(),
      displayPrimary: z.literal(true).optional()
    })
  )
})

export const workshopRouterAliasesSchema = z.array(
  z.object({
    id: modelId,
    routerId: modelId,
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
    nativeDefaults: nativeDefaults.optional(),
    condition: z.string().optional(),
    contentIssue: z.literal('wrong-model-media').optional(),
    displayPrimary: z.literal(true).optional()
  })
)
