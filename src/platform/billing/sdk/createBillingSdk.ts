/**
 * The app's one composition of `@comfyorg/account-core/billing`: the session-backed
 * transport, the readers, the operation lifecycle, and the payment commands,
 * wired once over ports the host supplies. Everything browser-bound (storage,
 * the payment-provider script, the document listeners) stays with the caller;
 * this module only assembles.
 */
import type {
  BillingCommands,
  BillingEventsReader,
  BillingOperationLifecycle,
  BillingOperationPointerStorage,
  BillingOperationTelemetryEvent,
  BillingScopeSource,
  BillingSession,
  BillingStatusReader,
  CapabilitiesReader,
  CreditsReader,
  HostedBillingDestination,
  PaymentMethodsReader,
  PlansReader,
  TopupCommand
} from '@comfyorg/account-core/billing'
import {
  createBillingCommands,
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

export interface BillingSdkOptions {
  readonly session: BillingSession
  /** Defaults to the scope the session last minted for. */
  readonly scopeSource?: BillingScopeSource
  readonly resolveUrl: (route: string) => string
  /** The target the host's session minted for; must match it or every request re-mints. */
  readonly workspaceId: () => string | undefined
  readonly pointerStorage?: BillingOperationPointerStorage
  /** Which origin serves a hosted page. */
  readonly hostedDestination: () => HostedBillingDestination
  readonly onTelemetry: (event: BillingOperationTelemetryEvent) => void
  readonly fetchImpl?: typeof fetch
}

export interface BillingSdk {
  readonly lifecycle: BillingOperationLifecycle
  readonly status: BillingStatusReader
  readonly credits: CreditsReader
  readonly capabilities: CapabilitiesReader
  readonly plans: PlansReader
  readonly paymentMethods: PaymentMethodsReader
  readonly events: BillingEventsReader
  readonly topup: TopupCommand
  readonly commands: BillingCommands
  readonly dispose: () => void
}

export function createBillingSdk(options: BillingSdkOptions): BillingSdk {
  const {
    session,
    resolveUrl,
    workspaceId,
    pointerStorage,
    hostedDestination,
    onTelemetry,
    fetchImpl
  } = options

  const transport = createSessionBillingTransport({
    session,
    resolveUrl,
    workspaceId,
    ...(fetchImpl === undefined ? {} : { fetchImpl })
  })
  const scopeSource = options.scopeSource ?? sessionBillingScopeSource(session)
  const status = createBillingStatusReader({ transport, scopeSource })
  const credits = createCreditsReader({ transport, scopeSource })
  const capabilities = createCapabilitiesReader({ transport, scopeSource })
  const plans = createPlansReader({ transport, scopeSource })
  const paymentMethods = createPaymentMethodsReader({ transport, scopeSource })
  const events = createBillingEventsReader({ transport, scopeSource })
  const lifecycle = createBillingOperationLifecycle({
    transport,
    scopeSource,
    statusReader: status,
    ...(pointerStorage === undefined ? {} : { pointerStorage }),
    hostedDestination,
    onTelemetry
  })
  const topup = createTopupCommand({
    transport,
    lifecycle,
    capabilities,
    credits
  })
  const commands = createBillingCommands({
    transport,
    lifecycle,
    statusReader: status,
    capabilities,
    credits
  })

  return {
    lifecycle,
    status,
    credits,
    capabilities,
    plans,
    paymentMethods,
    events,
    topup,
    commands,
    dispose: () => {
      lifecycle.dispose()
      status.dispose()
      credits.dispose()
      capabilities.dispose()
      plans.dispose()
      paymentMethods.dispose()
      events.dispose()
    }
  }
}
