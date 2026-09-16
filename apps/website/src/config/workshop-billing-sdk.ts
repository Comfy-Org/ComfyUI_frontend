/**
 * The Workshop's one composition of `@comfyorg/account/billing`, mirroring
 * the cloud app's `createBillingSdk`: the session-backed transport, the
 * readers over it, the operation lifecycle, and the top-up command. Every
 * constructor call lives here, so a change to their options is a one-file
 * change. Built on first use, so a page that never opens the buy-credits
 * dialog never constructs it — and nothing reaches sessionStorage on a
 * server render.
 */
import type { BillingSession, TopupCommand } from '@comfyorg/account/billing'
import {
  createBillingOperationLifecycle,
  createBillingStatusReader,
  createCapabilitiesReader,
  createCreditsReader,
  createSessionBillingTransport,
  createTopupCommand
} from '@comfyorg/account/billing'

import { workshopSessionClient } from './workshop-account'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

/** The workspace this session holds; a target-less mint resolves the personal one. */
function mintWorkspaceId(session: BillingSession): string | undefined {
  const snapshot = session.getSnapshot()
  return snapshot.phase === 'authenticated'
    ? snapshot.session.workspace.id
    : undefined
}

function createWorkshopTopupCommand(session: BillingSession): TopupCommand {
  const transport = createSessionBillingTransport({
    session,
    resolveUrl: (route) => `${WORKSHOP_CLOUD_BASE_URL}/api${route}`,
    workspaceId: () => mintWorkspaceId(session)
  })
  const credits = createCreditsReader({ transport, session })
  const capabilities = createCapabilitiesReader({ transport, session })
  // No `onTelemetry`: the site has no billing-operation funnel to feed.
  const lifecycle = createBillingOperationLifecycle({
    transport,
    session,
    statusReader: createBillingStatusReader({ transport, session }),
    pointerStorage: sessionStorage,
    embeddedCheckoutAvailable: () => false
  })
  return createTopupCommand({ transport, lifecycle, capabilities, credits })
}

let command: TopupCommand | undefined

export function workshopTopupCommand(): TopupCommand {
  return (command ??= createWorkshopTopupCommand(workshopSessionClient))
}
