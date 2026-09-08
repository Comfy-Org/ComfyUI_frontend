import {
  zAgentSkill,
  zAgentSkillListResponse
} from '@comfyorg/ingest-types/zod'

import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
import { api } from '@/scripts/api'

import type { SkillPack, SkillPackPublishRequest } from '../types'

/**
 * A failed skill-pack request. `status` is the whole error contract: 400 means
 * the user can edit this request into a valid one, 409 means a per-user budget
 * is full and another pack has to go, and 404 means the cohort gate is off so
 * the surface should disappear.
 */
export class SkillPacksApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'SkillPacksApiError'
  }
}

/**
 * The agent service answers with `{ "error": "..." }` while ingest answers with
 * the canonical `ErrorResponse`. Both shapes reach these routes — a 404 is
 * ingest-raised when the gate is off and agent-raised when the pack is missing
 * — so read the agent shape first and fall back to the canonical parse.
 */
async function toApiError(response: Response): Promise<SkillPacksApiError> {
  const clone = response.clone()
  try {
    const body: unknown = await clone.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { error?: unknown }).error === 'string'
    ) {
      return new SkillPacksApiError(
        (body as { error: string }).error,
        response.status
      )
    }
  } catch {
    // Fall through to the canonical ErrorResponse parse below.
  }
  const errorData = await parseErrorResponse(response)
  return new SkillPacksApiError(errorData.message, response.status)
}

export async function listSkillPacks(): Promise<SkillPack[]> {
  const response = await api.fetchApi('/agent/skills')
  if (!response.ok) throw await toApiError(response)
  return zAgentSkillListResponse.parse(await response.json()).skills
}

/**
 * Create or replace. Publishing a name the caller already holds is an update,
 * not a second pack, so this is the only write the editor needs.
 */
export async function publishSkillPack(
  payload: SkillPackPublishRequest
): Promise<SkillPack> {
  const response = await api.fetchApi('/agent/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) throw await toApiError(response)
  return zAgentSkill.parse(await response.json())
}

export async function deleteSkillPack(name: string): Promise<void> {
  const response = await api.fetchApi(
    `/agent/skills/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  )
  if (!response.ok) throw await toApiError(response)
}
