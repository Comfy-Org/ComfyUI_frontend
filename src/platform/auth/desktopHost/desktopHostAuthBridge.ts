import type {
  ComfyDesktop2AuthBridge,
  ComfyDesktop2AuthState
} from '@comfyorg/comfyui-desktop-bridge-types'

type DesktopHostSignedIn = Extract<
  ComfyDesktop2AuthState,
  { status: 'signed_in' }
>

/** A signed-in state may also carry the account's display name. */
export type DesktopHostAuthState =
  | Exclude<ComfyDesktop2AuthState, { status: 'signed_in' }>
  | (DesktopHostSignedIn & { name?: string })

/** `switchWorkspace` is absent on Desktop builds before Comfy-Desktop #1671. */
export type DesktopHostAuthBridge = Omit<
  ComfyDesktop2AuthBridge,
  'switchWorkspace'
> &
  Partial<Pick<ComfyDesktop2AuthBridge, 'switchWorkspace'>>
