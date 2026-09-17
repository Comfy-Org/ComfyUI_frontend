/**
 * The app's one composition of `@comfyorg/account-core/billing`: the session-backed
 * transport, the readers, the operation lifecycle, and the payment commands,
 * wired once over ports the host supplies. Everything browser-bound (storage,
 * the payment-provider script, the document listeners) stays with the caller;
 * this module only assembles.
 */
import type {
  BillingCommands,
  BillingOperationLifecycle,
  BillingOperationPointerStorage,
  BillingOperationTelemetryEvent,
  BillingSession,
  BillingStatusReader,
  CapabilitiesReader,
  CreditsReader,
  EmbeddedChallengeOutcome,
  EmbeddedChallengePort,
  HostedBillingDestination,
  PaymentMethodsReader,
  PlansReader,
  TopupCommand
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
  driveEmbeddedChallenge,
  sessionBillingScopeSource
} from '@comfyorg/account-core/billing'

export interface BillingSdkOptions {
  readonly session: BillingSession
  readonly resolveUrl: (route: string) => string
  /** The target the host's session minted for; must match it or every request re-mints. */
  readonly workspaceId: () => string | undefined
  readonly pointerStorage?: BillingOperationPointerStorage
  readonly embeddedCheckoutAvailable: () => boolean
  /** Which origin serves a hosted page. */
  readonly hostedDestination: () => HostedBillingDestination
  readonly onTelemetry: (event: BillingOperationTelemetryEvent) => void
  /** The payment-provider port, loaded on first use; undefined or a rejection when it cannot load. */
  readonly challengePort: () => Promise<EmbeddedChallengePort | undefined>
  readonly fetchImpl?: typeof fetch
}

export interface BillingSdk {
  readonly lifecycle: BillingOperationLifecycle
  readonly status: BillingStatusReader
  readonly credits: CreditsReader
  readonly capabilities: CapabilitiesReader
  readonly plans: PlansReader
  readonly paymentMethods: PaymentMethodsReader
  readonly topup: TopupCommand
  readonly commands: BillingCommands
  readonly driveChallenge: (
    operationId: string
  ) => Promise<EmbeddedChallengeOutcome>
  readonly dispose: () => void
}

/** A port that could not load fails the challenge; the operation stays observed. */
const UNAVAILABLE_CHALLENGE_PORT: EmbeddedChallengePort = {
  handleNextAction: () => Promise.resolve({ error: 'port_unavailable' })
}

export function createBillingSdk(options: BillingSdkOptions): BillingSdk {
  const {
    session,
    resolveUrl,
    workspaceId,
    pointerStorage,
    embeddedCheckoutAvailable,
    hostedDestination,
    onTelemetry,
    challengePort,
    fetchImpl
  } = options

  const transport = createSessionBillingTransport({
    session,
    resolveUrl,
    workspaceId,
    ...(fetchImpl === undefined ? {} : { fetchImpl })
  })
  const scopeSource = sessionBillingScopeSource(session)
  const status = createBillingStatusReader({ transport, scopeSource })
  const credits = createCreditsReader({ transport, scopeSource })
  const capabilities = createCapabilitiesReader({ transport, scopeSource })
  const plans = createPlansReader({ transport, scopeSource })
  const paymentMethods = createPaymentMethodsReader({ transport, scopeSource })
  const lifecycle = createBillingOperationLifecycle({
    transport,
    scopeSource,
    statusReader: status,
    ...(pointerStorage === undefined ? {} : { pointerStorage }),
    embeddedCheckoutAvailable,
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
    topup,
    commands,
    driveChallenge: async (operationId) =>
      driveEmbeddedChallenge(
        lifecycle,
        operationId,
        (await challengePort().catch(() => undefined)) ??
          UNAVAILABLE_CHALLENGE_PORT
      ),
    // Every scope-holder the core exposes, listed a second time next to the
    // helper in @comfyorg/account-ui; a new core reader has to join both.
    dispose: () => {
      lifecycle.dispose()
      status.dispose()
      credits.dispose()
      capabilities.dispose()
      plans.dispose()
      paymentMethods.dispose()
    }
  }
}
