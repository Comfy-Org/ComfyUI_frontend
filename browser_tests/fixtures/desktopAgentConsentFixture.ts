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
    __desktopConsentAuthState: () => Promise<ComfyDesktop2AuthState>
  }
}

class DesktopConsentSignIn {
  requests = 0
  state: ComfyDesktop2AuthState = { status: 'signed_out' }
  readonly consentAuthorizationHeaders: string[] = []
  private resolve: (state: ComfyDesktop2AuthState) => void = () => {}
  private readonly result = new Promise<ComfyDesktop2AuthState>((resolve) => {
    this.resolve = resolve
  })

  request(): Promise<ComfyDesktop2AuthState> {
    this.requests++
    return this.result
  }

  finishInBrowser(): void {
    this.state = {
      status: 'signed_in',
      userId: 'test-user-e2e',
      workspaceId: 'ws-personal'
    }
  }

  complete(): void {
    this.finishInBrowser()
    this.resolve(this.state)
  }
}

export const desktopAgentConsentTest = mergeTests(
  agentConsentTest,
  webSocketFixture
).extend<{
  desktopConsentSignIn: DesktopConsentSignIn
  desktopWorkspaceToken: string | null
}>({
  desktopConsentSignIn: async ({ browserName: _browserName }, use) => {
    await use(new DesktopConsentSignIn())
  },
  desktopWorkspaceToken: ['mock-workspace-token', { option: true }],
  page: async ({ page, desktopConsentSignIn, desktopWorkspaceToken }, use) => {
    await mockWorkspace(page, workspace('personal', 'owner'), [])
    await page.exposeFunction('__desktopConsentSignIn', () =>
      desktopConsentSignIn.request()
    )
    await page.exposeFunction(
      '__desktopConsentAuthState',
      () => desktopConsentSignIn.state
    )
    await page.addInitScript((workspaceToken) => {
      let state: ComfyDesktop2AuthState | undefined
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
        getState: async () =>
          (state ??= await window.__desktopConsentAuthState()),
        getWorkspaceToken: async (workspaceId: string) =>
          state?.status === 'signed_in' && state.workspaceId === workspaceId
            ? workspaceToken
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
    }, desktopWorkspaceToken)
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/api/global-settings')
      ) {
        desktopConsentSignIn.consentAuthorizationHeaders.push(
          request.headers()['authorization'] ?? ''
        )
      }
    })
    await use(page)
  }
})
