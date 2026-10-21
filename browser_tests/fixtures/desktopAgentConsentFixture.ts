import type { ComfyDesktop2AuthState } from '@comfyorg/comfyui-desktop-bridge-types'
import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'
import { mergeTests } from '@playwright/test'

import type { DesktopHostAuthBridge } from '@/platform/auth/desktopHost/desktopHostAuthBridge'

import { agentConsentTest } from '@e2e/fixtures/agentConsentFixture'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'

declare global {
  interface Window {
    __desktopConsentSignIn: () => Promise<ComfyDesktop2AuthState>
  }
}

class DesktopConsentSignIn {
  requests = 0
  private resolve: (state: ComfyDesktop2AuthState) => void = () => {}
  private readonly result = new Promise<ComfyDesktop2AuthState>((resolve) => {
    this.resolve = resolve
  })

  request(): Promise<ComfyDesktop2AuthState> {
    this.requests++
    return this.result
  }

  complete(): void {
    this.resolve({
      status: 'signed_in',
      userId: 'test-user-e2e',
      workspaceId: 'ws-personal'
    })
  }
}

export const desktopAgentConsentTest = mergeTests(
  agentConsentTest,
  webSocketFixture
).extend<{
  desktopConsentSignIn: DesktopConsentSignIn
}>({
  desktopConsentSignIn: async ({ browserName: _browserName }, use) => {
    await use(new DesktopConsentSignIn())
  },
  page: async ({ page, desktopConsentSignIn }, use) => {
    await mockWorkspace(page, workspace('personal', 'owner'), [])
    await page.exposeFunction('__desktopConsentSignIn', () =>
      desktopConsentSignIn.request()
    )
    await page.addInitScript(() => {
      let state: ComfyDesktop2AuthState = { status: 'signed_out' }
      const listeners = new Set<(next: ComfyDesktop2AuthState) => void>()
      const push = (next: ComfyDesktop2AuthState) => {
        state = next
        listeners.forEach((listener) => listener(next))
        return next
      }
      const electronAPI = {
        getElectronVersion: async () => '1.0.0',
        getComfyUIVersion: () => '0.0.0',
        getPlatform: () => 'win32',
        changeTheme: () => {}
      } satisfies Partial<ElectronAPI>
      const auth = {
        getState: async () => state,
        getWorkspaceToken: async (workspaceId: string) =>
          state.status === 'signed_in' && state.workspaceId === workspaceId
            ? 'mock-workspace-token'
            : null,
        requestSignIn: async () => push(await window.__desktopConsentSignIn()),
        signOut: async () => push({ status: 'signed_out' }),
        onChanged: (listener: (next: ComfyDesktop2AuthState) => void) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      } satisfies DesktopHostAuthBridge
      Object.assign(window, {
        electronAPI,
        __comfyDesktop2: {
          isRemote: () => false,
          Auth: auth
        }
      })
    })
    await use(page)
  }
})
