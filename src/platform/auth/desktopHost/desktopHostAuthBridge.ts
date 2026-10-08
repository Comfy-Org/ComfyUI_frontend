import type {
  ComfyDesktop2AuthBridge,
  ComfyDesktop2AuthState
} from '@comfyorg/comfyui-desktop-bridge-types'

export type DesktopHostAuthState = ComfyDesktop2AuthState

/** `switchWorkspace` lands with bridge types 0.5.0 (Comfy-Desktop #1671). */
export interface DesktopHostAuthBridge extends ComfyDesktop2AuthBridge {
  /** Absent on Desktop builds before Comfy-Desktop #1671. */
  switchWorkspace?(workspaceId: string): Promise<DesktopHostAuthState>
}
