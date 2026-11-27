import {
  zAgentBuiltinSkillListResponse,
  zAgentSkill,
  zAgentSkillListResponse
} from '@comfyorg/ingest-types/zod'

import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
import { api } from '@/scripts/api'

import type {
  BuiltinSkill,
  SkillPack,
  SkillPackPublishRequest
} from '@/platform/skills/types'
import { MAX_NAME_LENGTH, PACK_NAME_PATTERN } from '@/platform/skills/types'

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
 * Agent responses use `{ error }`; ingest uses the canonical ErrorResponse.
 * Preserve either producer's message, preferring explicit `message` fields.
 */
async function toApiError(response: Response): Promise<SkillPacksApiError> {
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => undefined)
  if (
    typeof body === 'object' &&
    body !== null &&
    !('message' in body) &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return new SkillPacksApiError(body.error, response.status)
  }
  const errorData = await parseErrorResponse(response)
  return new SkillPacksApiError(errorData.message, response.status)
}

export async function listSkillPacks(): Promise<SkillPack[]> {
  const response = await api.fetchApi('/agent/skills')
  if (!response.ok) throw await toApiError(response)
  return zAgentSkillListResponse.parse(await response.json()).skills
}

export type BuiltinSkillsListResult =
  | { status: 'ok'; skills: BuiltinSkill[] }
  | { status: 'unavailable' }
  | { status: 'error'; error: unknown }

export async function listBuiltinSkills(): Promise<BuiltinSkillsListResult> {
  try {
    const response = await api.fetchApi('/agent/skills/builtin')
    if (response.status === 404) return { status: 'unavailable' }
    if (!response.ok) {
      return { status: 'error', error: await toApiError(response) }
    }
    const skills = zAgentBuiltinSkillListResponse.parse(
      await response.json()
    ).skills
    return { status: 'ok', skills }
  } catch (error) {
    return { status: 'error', error }
  }
}

/** Publishing an existing name replaces that pack. */
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
  if (name.length > MAX_NAME_LENGTH || !PACK_NAME_PATTERN.test(name)) {
    throw new SkillPacksApiError('Invalid skill pack name', 400)
  }
  const response = await api.fetchApi(
    `/agent/skills/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  )
  if (!response.ok) throw await toApiError(response)
}
