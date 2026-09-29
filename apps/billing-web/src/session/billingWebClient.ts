/**
 * This origin's one composition of `@comfyorg/account-core/billing`: the
 * session-backed transport, the readers, the operation lifecycle, and the
 * commands, wired over ports this app owns. Every core constructor call lives
 * here, so the core's option shapes are one file's concern.
 *
 * The workspace a request runs against is the workspace its JWT was minted
 * for. The entry binding (`@/entry/workspaceBinding`) is read live, on every
 * call, so a later entry link that rebinds the tab reaches the very next
 * request; once no entry has named one, the transport pins mints to the
 * workspace the session already holds — a target-less mint would resolve the
 * personal workspace and read as the account silently switching itself.
 *
 * `embeddedCheckoutAvailable` follows the Stripe key: with one configured the
 * checkout form collects a card and drives a challenge in-page. Without one
 * the form reports itself unavailable and no payment can be started here —
 * the hosted continuation the lifecycle drives resumes a payment, it does not
 * open one.
 */
import type {
  BillingOperationPointerStorage,
  BillingScopeSource,
  BillingSession,
  BillingTransport,
  CredentialedWebSession
} from '@comfyorg/account-core/billing'
import {
  createBillingCommands,
  createCredentialedBillingTransport,
  createBillingEventsReader,
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
import { billingWebStripeKey } from '@/config/stripeKey'
import { boundWorkspaceId } from '@/entry/workspaceBinding'

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

function targetWorkspaceId(session: BillingSession): string | undefined {
  return boundWorkspaceId() ?? pinnedWorkspaceId(session)
}

const resolveUrl = (route: string) => `${CLOUD_BASE_URL}/api${route}`

export function createBillingWebClient(session: BillingSession): BillingClient {
  const transport = createSessionBillingTransport({
    session,
    resolveUrl,
    workspaceId: () => targetWorkspaceId(session)
  })
  return composeBillingWebClient(transport, sessionBillingScopeSource(session))
}

/**
 * On the shared web session: the cookie authorizes each request, and the
 * resolved workspace, which the entry link named, is its workspace header.
 */
export function createWebSessionBillingClient(unified: {
  readonly scopeSource: BillingScopeSource
  readonly webSession: CredentialedWebSession
  readonly fetchImpl: typeof fetch
}): BillingClient {
  const { scopeSource, webSession, fetchImpl } = unified
  const transport = createCredentialedBillingTransport({
    resolveUrl,
    scopeSource,
    webSession,
    fetchImpl
  })
  return composeBillingWebClient(transport, unified.scopeSource)
}

function composeBillingWebClient(
  transport: BillingTransport,
  scopeSource: BillingScopeSource
): BillingClient {
  const readerOptions = { transport, scopeSource }
  const capabilities = createCapabilitiesReader(readerOptions)
  const credits = createCreditsReader(readerOptions)
  const status = createBillingStatusReader(readerOptions)
  const plans = createPlansReader(readerOptions)
  const paymentMethods = createPaymentMethodsReader(readerOptions)
  const events = createBillingEventsReader(readerOptions)
  const lifecycle = createBillingOperationLifecycle({
    transport,
    scopeSource,
    statusReader: status,
    pointerStorage,
    embeddedCheckoutAvailable: () => billingWebStripeKey() !== undefined
  })

  return {
    lifecycle,
    capabilities,
    credits,
    status,
    plans,
    paymentMethods,
    events,
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
