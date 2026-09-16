/**
 * The app's one composition of `@comfyorg/account/billing`: the session-backed
 * transport, the three readers, the operation lifecycle, and the top-up
 * command, wired once over ports the host supplies. Everything browser-bound
 * (storage, the payment-provider script, the document listeners) stays with
 * the caller; this module only assembles.
 */
import type {
  BillingOperationLifecycle,
  BillingOperationPointerStorage,
  BillingOperationTelemetryEvent,
  BillingSession,
  BillingStatusReader,
  CapabilitiesReader,
  CreditsReader,
  EmbeddedChallengeOutcome,
  EmbeddedChallengePort,
  TopupCommand
} from '@comfyorg/account/billing'
import {
  createBillingOperationLifecycle,
  createBillingStatusReader,
  createCapabilitiesReader,
  createCreditsReader,
  createSessionBillingTransport,
  createTopupCommand,
  driveEmbeddedChallenge
} from '@comfyorg/account/billing'

export interface BillingSdkOptions {
  readonly session: BillingSession
  readonly resolveUrl: (route: string) => string
  /** The target the host's session minted for; must match it or every request re-mints. */
  readonly workspaceId: () => string | undefined
  readonly pointerStorage?: BillingOperationPointerStorage
  readonly embeddedCheckoutAvailable: () => boolean
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
  readonly topup: TopupCommand
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
  const status = createBillingStatusReader({ transport, session })
  const credits = createCreditsReader({ transport, session })
  const capabilities = createCapabilitiesReader({ transport, session })
  const lifecycle = createBillingOperationLifecycle({
    transport,
    session,
    statusReader: status,
    ...(pointerStorage === undefined ? {} : { pointerStorage }),
    embeddedCheckoutAvailable,
    onTelemetry
  })
  const topup = createTopupCommand({
    transport,
    lifecycle,
    capabilities,
    credits
  })

  return {
    lifecycle,
    status,
    credits,
    capabilities,
    topup,
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
    }
  }
}
