import type { PromptResponse } from '@comfyorg/api-client/types'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PartnerCredentials } from '@/platform/auth/partnerNode/partnerNodeQueueCredentials'
import {
  queuePromptAs,
  resolvePartnerCredentials,
  workspaceDrifted
} from '@/platform/auth/partnerNode/partnerNodeQueueCredentials'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('firebase/auth'))

const workflow: ComfyWorkflowJSON = {
  version: 1,
  state: { lastGroupId: 0, lastNodeId: 0, lastLinkId: 0, lastRerouteId: 0 },
  nodes: []
}

const prompt = { output: {}, workflow }

const credentials: PartnerCredentials = {
  authToken: 'app-token',
  apiKey: 'app-key',
  workspaceId: 'workspace-a',
  workspaceGeneration: 0,
  changedWhileAuthenticating: false
}

beforeEach(() => {
  delete api.authToken
  delete api.apiKey
  vi.mocked(useTeamWorkspaceStore().waitForWorkspaceSwitch).mockResolvedValue()
  Object.assign(useTeamWorkspaceStore(), {
    activeWorkspaceId: 'workspace-a',
    workspaceTransitionGeneration: 0
  })
  vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(
    'workspace-token'
  )
  useAuthStore().currentUser = null
  vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue(null)
  Object.assign(useApiKeyAuthStore(), { isAuthenticated: false })
})

describe('queuePromptAs', () => {
  it('submits with the given credentials', async () => {
    const seen: (string | undefined)[] = []
    vi.spyOn(api, 'queuePrompt').mockImplementation(async () => {
      seen.push(api.authToken, api.apiKey)
      return { prompt_id: 'job-1' }
    })

    await expect(queuePromptAs(credentials, prompt)).resolves.toEqual({
      prompt_id: 'job-1'
    })
    expect(seen).toEqual(['app-token', 'app-key'])
  })

  it('puts back a canvas queue credential before the request settles', () => {
    api.authToken = 'canvas-token'
    api.apiKey = 'canvas-key'
    vi.spyOn(api, 'queuePrompt').mockReturnValue(
      new Promise<PromptResponse>(() => {})
    )

    void queuePromptAs(credentials, prompt)

    expect([api.authToken, api.apiKey]).toEqual(['canvas-token', 'canvas-key'])
  })

  it('leaves no credential behind when none was set before', () => {
    vi.spyOn(api, 'queuePrompt').mockReturnValue(
      new Promise<PromptResponse>(() => {})
    )

    void queuePromptAs(credentials, prompt)

    expect(Object.hasOwn(api, 'authToken')).toBe(false)
    expect(Object.hasOwn(api, 'apiKey')).toBe(false)
  })

  it('restores the credentials when submitting throws synchronously', async () => {
    api.authToken = 'canvas-token'
    vi.spyOn(api, 'queuePrompt').mockImplementation(() => {
      throw new Error('socket closed')
    })

    await expect(queuePromptAs(credentials, prompt)).rejects.toThrow(
      'socket closed'
    )
    expect(api.authToken).toBe('canvas-token')
    expect(Object.hasOwn(api, 'apiKey')).toBe(false)
  })
})

describe('resolvePartnerCredentials', () => {
  it('returns the workspace token and the API key', async () => {
    vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue('stored-key')

    await expect(resolvePartnerCredentials()).resolves.toEqual({
      ok: true,
      credentials: {
        authToken: 'workspace-token',
        apiKey: 'stored-key',
        workspaceId: 'workspace-a',
        workspaceGeneration: 0,
        changedWhileAuthenticating: false
      }
    })
  })

  it('refuses when a workspace is active but no one is signed in', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)

    await expect(resolvePartnerCredentials()).resolves.toEqual({
      ok: false,
      reason: 'notSignedIn'
    })
  })

  it('reports a failed workspace switch with its error', async () => {
    const error = new Error('Token exchange failed')
    vi.mocked(useTeamWorkspaceStore().waitForWorkspaceSwitch).mockRejectedValue(
      error
    )

    await expect(resolvePartnerCredentials()).resolves.toEqual({
      ok: false,
      reason: 'workspaceSwitchFailed',
      error
    })
    expect(useAuthStore().getWorkspaceAuthToken).not.toHaveBeenCalled()
  })

  it('marks credentials minted while the workspace changed as drifted', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockImplementation(
      async () => {
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: 'workspace-b'
        })
        return 'workspace-token'
      }
    )

    const outcome = await resolvePartnerCredentials()

    assert(outcome.ok)
    expect(outcome.credentials.changedWhileAuthenticating).toBe(true)
    expect(workspaceDrifted(outcome.credentials)).toBe(true)
  })
})

describe('workspaceDrifted', () => {
  it.for([
    {
      name: 'nothing changed',
      workspace: {
        activeWorkspaceId: 'workspace-a',
        workspaceTransitionGeneration: 0
      },
      drifted: false
    },
    {
      name: 'another workspace is active',
      workspace: {
        activeWorkspaceId: 'workspace-b',
        workspaceTransitionGeneration: 0
      },
      drifted: true
    },
    {
      name: 'the same workspace was switched away and back',
      workspace: {
        activeWorkspaceId: 'workspace-a',
        workspaceTransitionGeneration: 2
      },
      drifted: true
    }
  ])('is $drifted when $name', ({ workspace, drifted }) => {
    Object.assign(useTeamWorkspaceStore(), workspace)

    expect(workspaceDrifted(credentials)).toBe(drifted)
  })
})
