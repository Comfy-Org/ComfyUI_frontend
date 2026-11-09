import type { ComfyDesktop2AuthState } from '@comfyorg/comfyui-desktop-bridge-types'

import type { DesktopHostAuthBridge } from '@/platform/auth/desktopHost/desktopHostAuthBridge'

import { agentFullscreenTest } from '@e2e/fixtures/agentFullscreenFixture'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

declare global {
  interface Window {
    __hostAuthSwitch: (workspaceId: string) => Promise<void>
    __hostAuthSignOut: () => Promise<void>
  }
}

/** What the Desktop host was asked to do, and how often the page reloaded. */
export interface HostAuthActivity {
  switches: string[]
  signOuts: number
  navigations: number
}

export const HOST_USER_ID = 'host-user-e2e'
export const HOST_PERSONAL_WORKSPACE = workspace('personal', 'owner')
export const HOST_TEAM_WORKSPACE = workspace('team', 'member')

/**
 * Boots the full screen on the localhost distribution inside a Comfy Desktop
 * host: `window.__comfyDesktop2.Auth` is signed in to the personal workspace
 * and can switch workspaces, and every switch and sign-out it receives is
 * recorded on `hostAuth`.
 */
export const agentFullscreenDesktopTest = agentFullscreenTest.extend<{
  hostAuth: HostAuthActivity
}>({
  agentWorkspaces: [
    [HOST_PERSONAL_WORKSPACE, HOST_TEAM_WORKSPACE],
    { scope: 'test' }
  ],
  hostAuth: async ({ browserName: _browserName }, use) => {
    await use({ switches: [], signOuts: 0, navigations: 0 })
  },
  page: async ({ page, hostAuth }, use) => {
    await page.exposeFunction('__hostAuthSwitch', (workspaceId: string) => {
      hostAuth.switches.push(workspaceId)
    })
    await page.exposeFunction('__hostAuthSignOut', () => {
      hostAuth.signOuts++
    })
    page.on('load', () => {
      hostAuth.navigations++
    })
    await page.addInitScript(
      ({ userId, workspaceId }) => {
        const email = 'host@example.com'
        let state: ComfyDesktop2AuthState = {
          status: 'signed_in',
          userId,
          email,
          workspaceId
        }
        const listeners = new Set<(next: ComfyDesktop2AuthState) => void>()
        const push = (next: ComfyDesktop2AuthState) => {
          state = next
          listeners.forEach((listener) => listener(next))
          return next
        }
        const auth = {
          getState: async () => state,
          getWorkspaceToken: async (requested: string) =>
            state.status === 'signed_in' && state.workspaceId === requested
              ? 'host-workspace-token'
              : null,
          requestSignIn: async () => state,
          switchWorkspace: async (nextWorkspaceId: string) => {
            await window.__hostAuthSwitch(nextWorkspaceId)
            return push({
              status: 'signed_in',
              userId,
              email,
              workspaceId: nextWorkspaceId
            })
          },
          signOut: async () => {
            await window.__hostAuthSignOut()
            return push({ status: 'signed_out' })
          },
          onChanged: (listener: (next: ComfyDesktop2AuthState) => void) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          }
        } satisfies DesktopHostAuthBridge
        Object.assign(window, {
          __comfyDesktop2: { isRemote: () => false, Auth: auth }
        })
      },
      { userId: HOST_USER_ID, workspaceId: HOST_PERSONAL_WORKSPACE.id }
    )
    await use(page)
  }
})
