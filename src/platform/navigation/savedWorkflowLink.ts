import { isWorkspaceId } from '@comfyorg/account-core/workspaceLink'
import { validate as isUuid } from 'uuid'
import type { LocationQueryRaw } from 'vue-router'
import { z } from 'zod'

const targetId = z.string().refine(isWorkspaceId).optional()
const savedWorkflowLinkSchema = z
  .object({
    savedFile: z.string().refine((id) => isUuid(id) && id === id.toLowerCase()),
    workspace: targetId,
    deployment: targetId,
    environment: z.literal('standard').optional()
  })
  .refine(
    (link) => link.deployment === undefined || link.workspace !== undefined
  )
  .refine(
    (link) =>
      link.environment === undefined ||
      (link.workspace !== undefined && link.deployment === undefined)
  )

type SavedWorkflowLink =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'legacy' }
  | {
      status: 'valid'
      savedFileId: string
      workspaceId: string | null
      deploymentId: string | null
      environment: 'standard' | null
    }

export function readSavedWorkflowLink(
  query: LocationQueryRaw
): SavedWorkflowLink {
  if (query.savedFile !== undefined && query.workflow !== undefined)
    return { status: 'invalid' }
  if (query.workflow !== undefined) return { status: 'legacy' }
  if (query.savedFile === undefined) return { status: 'absent' }
  const result = savedWorkflowLinkSchema.safeParse(query)
  if (!result.success) return { status: 'invalid' }

  return {
    status: 'valid',
    savedFileId: result.data.savedFile,
    workspaceId: result.data.workspace ?? null,
    deploymentId: result.data.deployment ?? null,
    environment: result.data.environment ?? null
  }
}
