import type {
  ComfyDesktop2AuthBridge,
  ComfyDesktop2AuthState
} from '@comfyorg/comfyui-desktop-bridge-types'

export type DesktopHostAuthState = ComfyDesktop2AuthState

/** `switchWorkspace` is absent on Desktop builds before Comfy-Desktop #1671. */
export type DesktopHostAuthBridge = Omit<
  ComfyDesktop2AuthBridge,
  'switchWorkspace'
> &
  Partial<Pick<ComfyDesktop2AuthBridge, 'switchWorkspace'>>
