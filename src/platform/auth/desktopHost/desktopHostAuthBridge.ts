/**
 * Mirrors `__comfyDesktop2.Auth` (Comfy-Desktop #1657). The pinned
 * `@comfyorg/comfyui-desktop-bridge-types` predates it; switch to the package
 * types once a version carrying `ComfyDesktop2AuthBridge` is pinned.
 */
export type DesktopHostAuthState =
  | { status: 'disabled' }
  | { status: 'signed_out' }
  | {
      status: 'signed_in'
      userId: string
      email?: string
      workspaceId?: string
    }

export interface DesktopHostAuthBridge {
  getState(): Promise<DesktopHostAuthState>
  getAccessToken(workspaceId?: string): Promise<string | null>
  requestSignIn(): Promise<DesktopHostAuthState>
  signOut(): Promise<DesktopHostAuthState>
  onChanged(callback: (state: DesktopHostAuthState) => void): () => void
}
