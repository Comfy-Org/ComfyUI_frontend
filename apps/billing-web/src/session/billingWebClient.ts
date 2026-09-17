/**
 * This origin's one composition of `@comfyorg/account-core/billing`: the
 * session-backed transport, the readers, the operation lifecycle, and the
 * commands, wired over ports this app owns. Every core constructor call lives
 * here, so the core's option shapes are one file's concern.
 *
 * The workspace a request runs against is the workspace its JWT was minted
 * for, so the transport pins mints to the workspace the session already
 * holds; a target-less mint would resolve the personal workspace and read as
 * the account silently switching itself.
 *
 * `embeddedCheckoutAvailable` is false: this app has no payment-provider
 * script yet, so every operation routes hosted.
 */
import type {
  BillingOperationPointerStorage,
  BillingSession
} from '@comfyorg/account-core/billing'
import {
  createBillingCommands,
  createBillingOperationLifecycle,
  createBillingStatusReader,
  createCapabilitiesReader,
  createCreditsReader,
  createPaymentMethodsReader,
  createPlansReader,
  createSessionBillingTransport,
  createTopupCommand,
  sessionBillingScopeSource
} from '@comfyorg/account-core/billing'
import type { BillingClient } from '@comfyorg/account-ui/billing'

import { CLOUD_BASE_URL } from '@/config/env'

/** Tab-local, like the credential cache: a pointer must not outlive the tab. */
const pointerStorage: BillingOperationPointerStorage = {
  getItem: (key) => globalThis.sessionStorage.getItem(key),
  setItem: (key, value) => globalThis.sessionStorage.setItem(key, value),
  removeItem: (key) => globalThis.sessionStorage.removeItem(key)
}

function pinnedWorkspaceId(session: BillingSession): string | undefined {
  const current = session.getSnapshot()
  return current.phase === 'authenticated'
    ? current.session.workspace.id
    : undefined
}

export function createBillingWebClient(session: BillingSession): BillingClient {
  const transport = createSessionBillingTransport({
    session,
    resolveUrl: (route) => `${CLOUD_BASE_URL}/api${route}`,
    workspaceId: () => pinnedWorkspaceId(session)
  })
  const scopeSource = sessionBillingScopeSource(session)
  const readerOptions = { transport, scopeSource }
  const capabilities = createCapabilitiesReader(readerOptions)
  const credits = createCreditsReader(readerOptions)
  const status = createBillingStatusReader(readerOptions)
  const plans = createPlansReader(readerOptions)
  const paymentMethods = createPaymentMethodsReader(readerOptions)
  const lifecycle = createBillingOperationLifecycle({
    transport,
    scopeSource,
    statusReader: status,
    pointerStorage,
    embeddedCheckoutAvailable: () => false
  })

  return {
    lifecycle,
    capabilities,
    credits,
    status,
    plans,
    paymentMethods,
    topup: createTopupCommand({ transport, lifecycle, capabilities, credits }),
    commands: createBillingCommands({
      transport,
      lifecycle,
      statusReader: status,
      capabilities,
      credits
    })
  }
}
