import type { PromptResponse } from '@comfyorg/api-client/types'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@comfyorg/graph-model/workflowSchema'

import { isDesktopHostSignedIn } from '@/platform/auth/desktopHost/desktopHostSession'
import { queueAuthToken } from '@/platform/auth/partnerNode/partnerNodeQueueToken'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

export interface PartnerCredentials {
  authToken: string | undefined
  apiKey: string | undefined
  workspaceId: string | null
  workspaceGeneration: number
  changedWhileAuthenticating: boolean
}

export type PartnerCredentialsOutcome =
  | { ok: true; credentials: PartnerCredentials }
  | { ok: false; reason: 'workspaceSwitchFailed'; error: unknown }
  | { ok: false; reason: 'notSignedIn' }

type QueuePromptOptions = Parameters<typeof api.queuePrompt>[2]

interface QueuedPrompt {
  output: ComfyApiWorkflow
  workflow: ComfyWorkflowJSON
}

async function waitForWorkspaceSwitch(): Promise<
  { ok: true } | { ok: false; error: unknown }
> {
  try {
    await useTeamWorkspaceStore().waitForWorkspaceSwitch()
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

function isApiKeySession(desktopHostAuth: boolean): boolean {
  const authStore = useAuthStore()
  return (
    !desktopHostAuth &&
    !authStore.currentUser &&
    !authStore.sessionOnlyUser &&
    useApiKeyAuthStore().isAuthenticated
  )
}

/** The partner-node credentials a prompt queued now would carry, resolved the way `app.queuePrompt` does. */
export async function resolvePartnerCredentials(): Promise<PartnerCredentialsOutcome> {
  const switched = await waitForWorkspaceSwitch()
  if (!switched.ok) {
    return { ok: false, reason: 'workspaceSwitchFailed', error: switched.error }
  }
  const workspaces = useTeamWorkspaceStore()
  const workspaceIdBefore = workspaces.activeWorkspaceId
  const generationBefore = workspaces.workspaceTransitionGeneration
  const workspaceToken = await useAuthStore().getWorkspaceAuthToken()
  const workspaceId = workspaces.activeWorkspaceId
  const workspaceGeneration = workspaces.workspaceTransitionGeneration
  const authToken = await queueAuthToken(workspaceToken, workspaceId)
  const changedWhileAuthenticating =
    (workspaceIdBefore !== workspaceId ||
      generationBefore !== workspaceGeneration) &&
    (isCloud || workspaceIdBefore !== null)
  const desktopHostAuth = isDesktopHostSignedIn()
  const apiKey = desktopHostAuth
    ? undefined
    : (useApiKeyAuthStore().getApiKey() ?? undefined)
  if (workspaceId && !authToken && !isApiKeySession(desktopHostAuth)) {
    return { ok: false, reason: 'notSignedIn' }
  }
  return {
    ok: true,
    credentials: {
      authToken,
      apiKey,
      workspaceId,
      workspaceGeneration,
      changedWhileAuthenticating
    }
  }
}

export function workspaceDrifted(credentials: PartnerCredentials): boolean {
  const workspaces = useTeamWorkspaceStore()
  return (
    credentials.changedWhileAuthenticating ||
    credentials.workspaceId !== workspaces.activeWorkspaceId ||
    credentials.workspaceGeneration !== workspaces.workspaceTransitionGeneration
  )
}

function restoreField(
  field: 'authToken' | 'apiKey',
  value: string | undefined
) {
  if (value === undefined) delete api[field]
  else api[field] = value
}

async function submitPrompt(
  prompt: QueuedPrompt,
  options: QueuePromptOptions
): Promise<PromptResponse> {
  return api.queuePrompt(0, prompt, options)
}

/** Queues `prompt` with `credentials`, restoring the previous api credentials before the request settles. */
export function queuePromptAs(
  credentials: PartnerCredentials,
  prompt: QueuedPrompt,
  options?: QueuePromptOptions
): Promise<PromptResponse> {
  const previousAuthToken = api.authToken
  const previousApiKey = api.apiKey
  api.authToken = credentials.authToken
  api.apiKey = credentials.apiKey
  const request = submitPrompt(prompt, options)
  restoreField('authToken', previousAuthToken)
  restoreField('apiKey', previousApiKey)
  return request
}
