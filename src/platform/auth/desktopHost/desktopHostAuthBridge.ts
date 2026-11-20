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

/** Desktop's answer to a billing handoff request; it never returns its credential. */
export type DesktopHostBillingHandoff =
  | { status: 'issued'; entryUrl: string }
  | { status: 'sign_in_again' }
  | { status: 'refused'; code?: string; message?: string }
  | { status: 'disabled' }

export type DesktopHostBillingReceiver = 'billing_web' | 'platform'

export type DesktopHostBillingIntent = 'top-up' | 'subscription'

/**
 * `switchWorkspace` is absent on Desktop builds before Comfy-Desktop #1671,
 * `getPartnerNodeToken` on builds before Comfy-Desktop #1983.
 */
export type DesktopHostAuthBridge = Omit<
  ComfyDesktop2AuthBridge,
  'switchWorkspace'
> &
  Partial<Pick<ComfyDesktop2AuthBridge, 'switchWorkspace'>> & {
    issueBillingHandoff?(
      workspaceId: string,
      receiver: DesktopHostBillingReceiver,
      intent?: DesktopHostBillingIntent,
      amountCents?: number
    ): Promise<DesktopHostBillingHandoff>
    getPartnerNodeToken?: (workspaceId: string) => Promise<string | null>
  }
