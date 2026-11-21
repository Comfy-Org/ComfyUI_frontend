/**
 * The core objects a host builds once — the lifecycle, the readers, the
 * commands — handed to every composable here either explicitly or through
 * the injection key, so one component tree shares one client.
 */
import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'

import type {
  BillingCommands,
  BillingEventsReader,
  BillingOperationLifecycle,
  BillingStatusReader,
  CapabilitiesReader,
  CreditsReader,
  PaymentMethodsReader,
  PlansReader,
  TopupCommand
} from '@comfyorg/account-core/billing'

/**
 * The host owns this client's lifetime. Composables never dispose what they
 * are handed, because a shared client cannot be torn down by whichever
 * component unmounts first, so when the session scope ends — sign-out, an
 * account or workspace switch — the host must call `disposeBillingClient`.
 * A retained reader goes on serving the scope it was built for, which is the
 * previous account's balance, capabilities, subscription status, plan catalog
 * and saved cards.
 */
export interface BillingClient {
  readonly lifecycle: BillingOperationLifecycle
  readonly capabilities: CapabilitiesReader
  readonly credits: CreditsReader
  readonly status: BillingStatusReader
  readonly plans: PlansReader
  readonly paymentMethods: PaymentMethodsReader
  readonly events: BillingEventsReader
  readonly topup: TopupCommand
  readonly commands: BillingCommands
}

export const BILLING_CLIENT_KEY: InjectionKey<BillingClient> = Symbol(
  'comfy:account-ui:billing-client'
)

export function provideBillingClient(client: BillingClient): void {
  provide(BILLING_CLIENT_KEY, client)
}

/**
 * Ends the client's lifetime by disposing everything in it that holds a scope
 * subscription. `topup` and `commands` hold none; they run on the lifecycle
 * and the readers disposed here.
 */
export function disposeBillingClient(client: BillingClient): void {
  client.lifecycle.dispose()
  client.capabilities.dispose()
  client.credits.dispose()
  client.status.dispose()
  client.plans.dispose()
  client.paymentMethods.dispose()
  client.events.dispose()
}

export function useBillingClient<K extends keyof BillingClient>(
  explicit: Pick<BillingClient, K> | undefined
): Pick<BillingClient, K> {
  const client = explicit ?? inject(BILLING_CLIENT_KEY)
  if (client === undefined) {
    throw new Error(
      'No billing client: pass one to the composable or call provideBillingClient() in an ancestor'
    )
  }
  return client
}
