import type { Request } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { makeWorkspaceTokenResponse } from '@e2e/fixtures/data/workspaceAuthFixtures'
import {
  WORKSPACE_SWITCHER_REMOTE_CONFIG,
  WORKSPACE_SWITCHER_WORKSPACES
} from '@e2e/fixtures/data/workspaceSwitcher'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspaceSwitcherTest } from '@e2e/fixtures/workspaceSwitcherFixture'

export const HOST_WORKSPACE_ID = 'ws-personal'
export const HOST_OAUTH_TOKEN = 'host-oauth-token'
export const PARTNER_NODE_TOKEN = 'partner-node-token'

interface HostPartnerNodeTraffic {
  mints: Request[]
  revokes: Request[]
  /** Answers partner-node mints with this status instead of a token. */
  failMintsWith: (status: number) => void
}

/**
 * Boots Local with a signed-in host session (the Desktop bridge on
 * `window.__comfyDesktop2.Auth`) scoped to `HOST_WORKSPACE_ID`, the
 * `partner_node_token` flag on, and the partner-node mint and revoke routes
 * answered and recorded.
 */
export const hostSessionPartnerNodeTest = workspaceSwitcherTest.extend<{
  hostPartnerNode: HostPartnerNodeTraffic
}>({
  hostPartnerNode: async ({ browserName: _browserName }, use) => {
    await use({ mints: [], revokes: [], failMintsWith: () => {} })
  },
  page: async ({ page, hostPartnerNode }, use) => {
    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({
          ...WORKSPACE_SWITCHER_REMOTE_CONFIG,
          partner_node_token: true
        } satisfies RemoteConfig)
      )
    )

    let mintFailureStatus: number | undefined
    hostPartnerNode.failMintsWith = (status) => {
      mintFailureStatus = status
    }
    await page.route('**/api/auth/token', async (route) => {
      const body = route.request().postDataJSON() as {
        workspace_id?: string
        resource?: string
      }
      if (body.resource !== 'partner-node') return route.fallback()
      hostPartnerNode.mints.push(route.request())
      if (mintFailureStatus) {
        return route.fulfill({ status: mintFailureStatus })
      }
      const workspace = WORKSPACE_SWITCHER_WORKSPACES.find(
        ({ id }) => id === body.workspace_id
      )
      if (!workspace) return route.fulfill({ status: 403 })
      await route.fulfill(
        jsonRoute(
          makeWorkspaceTokenResponse(
            workspace,
            PARTNER_NODE_TOKEN,
            90 * 60 * 1000
          )
        )
      )
    })
    await page.route('**/api/auth/token/revoke', async (route) => {
      hostPartnerNode.revokes.push(route.request())
      await route.fulfill({ status: 204 })
    })

    await page.addInitScript(
      ({ workspaceId, token }) => {
        type AuthState =
          | { status: 'signed_out' }
          | { status: 'signed_in'; userId: string; workspaceId: string }
        let state: AuthState = {
          status: 'signed_in',
          userId: 'host-a',
          workspaceId
        }
        const listeners = new Set<(next: AuthState) => void>()
        const push = (next: AuthState) => {
          state = next
          listeners.forEach((listener) => listener(next))
          return next
        }
        Object.assign(window, {
          __pushHostAuthState: push,
          __comfyDesktop2: {
            isRemote: () => false,
            Auth: {
              getState: async () => state,
              getWorkspaceToken: async (requested: string) =>
                state.status === 'signed_in' && state.workspaceId === requested
                  ? token
                  : null,
              requestSignIn: async () => state,
              signOut: async () => push({ status: 'signed_out' }),
              onChanged: (listener: (next: AuthState) => void) => {
                listeners.add(listener)
                return () => listeners.delete(listener)
              }
            }
          }
        })
      },
      { workspaceId: HOST_WORKSPACE_ID, token: HOST_OAUTH_TOKEN }
    )

    await use(page)
  }
})
