import type { APIRequestContext, APIResponse } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  zErrorResponse,
  zListWorkspacesResponse,
  zRevokeAllSessionsResponse
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import type {
  CrossOriginSessionEnv,
  CrossOriginSessionEnvKey
} from '@e2e/fixtures/utils/crossOriginSessionConfig'
import {
  missingSessionEnv,
  refusedComfyEgress
} from '@e2e/fixtures/utils/crossOriginSessionConfig'
import type { NetworkPolicy } from '@e2e/fixtures/utils/networkPolicy'

export type SessionAccount = { email: string; password: string }

const IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com'

const zFeatures = z.object({
  firebase_config: z.object({ apiKey: z.string().min(1) })
})

const zFirebaseSignIn = z.object({ idToken: z.string().min(1) })

type WorkspaceIds = {
  personalId: string
  team: { id: string; name: string }
}

type SendOptions = {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  data?: Record<string, unknown>
}

/**
 * The account acting from "another device": its own request context, no shared
 * cookie jar, authorized by a Firebase ID token it signs in for itself.
 */
export class SessionAdmin {
  private idToken: Promise<string> | undefined

  constructor(
    private readonly request: APIRequestContext,
    private readonly env: CrossOriginSessionEnv,
    private readonly networkPolicy: NetworkPolicy
  ) {}

  private require(keys: readonly CrossOriginSessionEnvKey[]) {
    const missing = missingSessionEnv(this.env, keys)
    if (missing.length > 0) {
      throw new Error(
        `Set ${missing.join(', ')}. See browser_tests/tests/crossOriginSession/README.md.`
      )
    }
  }

  private get cloudOrigin(): string {
    this.require(['SESSION_E2E_CLOUD_URL'])
    const origin = this.env.SESSION_E2E_CLOUD_URL
    if (origin === undefined) throw new Error('SESSION_E2E_CLOUD_URL is unset')
    return origin
  }

  private get account(): SessionAccount {
    this.require(['SESSION_E2E_EMAIL', 'SESSION_E2E_PASSWORD'])
    const { SESSION_E2E_EMAIL: email, SESSION_E2E_PASSWORD: password } =
      this.env
    if (email === undefined || password === undefined) {
      throw new Error('SESSION_E2E_EMAIL and SESSION_E2E_PASSWORD are unset')
    }
    return { email, password }
  }

  /** A request context bypasses `context.route`, so it re-applies the egress rules. */
  private async send(
    url: string,
    { method = 'GET', headers, data }: SendOptions = {}
  ): Promise<APIResponse> {
    const target = new URL(url)
    const { origins, unexpected } = this.networkPolicy
    const refused =
      refusedComfyEgress(target, origins) ??
      (origins.has(target.origin) ? undefined : 'Unlisted host')
    if (refused) {
      const entry = `${refused} ${method} ${target.origin}${target.pathname}`
      unexpected.add(entry)
      throw new Error(`Session admin refused to reach ${entry}`)
    }
    return this.request.fetch(url, { method, headers, data, maxRedirects: 0 })
  }

  private async firebaseApiKey(): Promise<string> {
    const response = await this.send(`${this.cloudOrigin}/api/features`)
    expect(response.ok(), 'Cloud serves /api/features').toBe(true)
    return zFeatures.parse(await response.json()).firebase_config.apiKey
  }

  private async signIn(): Promise<string> {
    const { email, password } = this.account
    const apiKey = await this.firebaseApiKey()
    const response = await this.send(
      `${IDENTITY_TOOLKIT}/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { Origin: this.cloudOrigin, Referer: `${this.cloudOrigin}/` },
        data: { email, password, returnSecureToken: true }
      }
    )
    expect(response.ok(), 'Firebase accepts the admin sign-in').toBe(true)
    return zFirebaseSignIn.parse(await response.json()).idToken
  }

  /** One Firebase sign-in per test, however many admin calls follow. */
  firebaseSignIn(): Promise<string> {
    this.idToken ??= this.signIn()
    return this.idToken
  }

  private async authorized(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.firebaseSignIn()}`,
      Origin: this.cloudOrigin
    }
  }

  /** Sign out of all devices: ends every web session the account holds. */
  async revokeAll(): Promise<number> {
    const response = await this.send(
      `${this.cloudOrigin}/api/auth/sessions/revoke-all`,
      { method: 'POST', headers: await this.authorized() }
    )
    if (response.status() === 404) {
      throw new Error(
        'web_session_enabled is off for SESSION_E2E_EMAIL: revoke-all returned 404'
      )
    }
    expect(response.ok(), 'revoke-all is accepted').toBe(true)
    return zRevokeAllSessionsResponse.parse(await response.json()).revoked
  }

  async workspaces(teamWorkspaceId: string): Promise<WorkspaceIds> {
    const response = await this.send(`${this.cloudOrigin}/api/workspaces`, {
      headers: await this.authorized()
    })
    expect(response.ok(), 'The account lists its workspaces').toBe(true)
    const { workspaces } = zListWorkspacesResponse.parse(await response.json())
    const personal = workspaces.find(({ type }) => type === 'personal')
    const team = workspaces.find(({ id }) => id === teamWorkspaceId)
    if (!personal) throw new Error('The account has no personal workspace')
    if (!team) {
      throw new Error(
        `SESSION_E2E_TEAM_WORKSPACE_ID ${teamWorkspaceId} is not one of the account's workspaces`
      )
    }
    return {
      personalId: personal.id,
      team: { id: team.id, name: team.name }
    }
  }

  /** A read with no Origin and no Sec-Fetch-Site: what a same-origin read is not. */
  async readSessionWithoutOrigin(): Promise<{
    status: number
    code: string | undefined
  }> {
    const response = await this.send(`${this.cloudOrigin}/api/auth/session`)
    const body = zErrorResponse.safeParse(
      await response.json().catch(() => undefined)
    )
    return {
      status: response.status(),
      code: body.success ? body.data.code : undefined
    }
  }
}
