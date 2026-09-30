/**
 * Mirrors `__comfyDesktop2.Auth` from Comfy Desktop. The published
 * `@comfyorg/comfyui-desktop-bridge-types` predates it; switch to the package
 * types once a version carrying `ComfyDesktop2AuthBridge` is pinned.
 */
export type HostAuthState =
  | { status: 'disabled' }
  | { status: 'signed_out' }
  | {
      status: 'signed_in'
      userId: string
      email?: string
      emailVerified?: boolean
      workspaceId?: string
    }

export type HostAuthRefusal = 'unauthorized' | 'sso_required'

export interface HostAuthBridge {
  getState(): Promise<HostAuthState>
  getAccessToken(): Promise<string | null>
  requestSignIn(): Promise<HostAuthState>
  reportRefusal(
    accessToken: string,
    reason: HostAuthRefusal
  ): Promise<HostAuthState>
  onChanged(callback: (state: HostAuthState) => void): () => void
}
