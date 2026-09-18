/**
 * Layer C of the billing rollout: which origin a hosted billing action opens.
 *
 * The server decides, through `hosted_billing_destination`. `stripe` means the
 * URL the backend already handed back — `action_url`, `payment_method_url`, a
 * portal link — is opened unchanged, so the host never composes a provider
 * URL of its own. `billing_web` means the host mints a `/v1/<intent>` entry
 * from `@comfyorg/billing-contract`, the one definition of that route surface.
 *
 * Every hosted surface reads the same flag, so they flip together and stay
 * independent of Layer A: whether an action reached here over the SDK rail or
 * the legacy client says nothing about where it should land.
 *
 * Anything unresolved fails closed to the provider — no configured billing-web
 * origin, an environment whose return target has no destination, an entry the
 * contract refuses to build. A customer on the provider page is served; one on
 * an origin nobody hosts, or with no way back, is stranded.
 */
import type {
  BillingEnvironment,
  BillingIntent,
  ReturnTarget
} from '@comfyorg/billing-contract'
import {
  buildBillingEntryUrl,
  resolveReturnTarget
} from '@comfyorg/billing-contract'

import type { HostedBillingDestination } from '@/config/billingWeb'
import { getBillingWebUrl } from '@/config/billingWeb'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type { DeployEnv } from '@/platform/telemetry/initDatadogRum'
import { resolveDeployEnv } from '@/platform/telemetry/initDatadogRum'

export type HostedBillingRoute =
  | { readonly kind: 'billing_web'; readonly url: URL }
  | { readonly kind: 'provider' }

const PROVIDER: HostedBillingRoute = { kind: 'provider' }

const PRODUCT = 'comfyui'
const RETURN_TO: ReturnTarget = 'comfyui_workspace'

const BILLING_ENVIRONMENT_BY_DEPLOY_ENV: Readonly<
  Record<DeployEnv, BillingEnvironment>
> = {
  'prod-v2': 'production',
  'stg-v2': 'staging',
  'test-v2': 'test'
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/**
 * The family the session was minted against, not the label on this build: a
 * developer running the frontend locally still talks to a deployed backend,
 * so the cloud base URL classifies the trip and `window.location` cannot. A
 * base URL that will not parse classifies nothing, so it fails closed like any
 * other unresolved environment rather than throwing through the caller.
 */
function hostBillingEnvironment(
  cloudBaseUrl = getComfyCloudBaseUrl()
): BillingEnvironment | undefined {
  const hostname = hostnameOf(cloudBaseUrl)
  if (hostname === undefined) return undefined

  const deployEnv = resolveDeployEnv(hostname)
  return deployEnv === undefined
    ? undefined
    : BILLING_ENVIRONMENT_BY_DEPLOY_ENV[deployEnv]
}

/**
 * Re-bases a contract route under the configured billing-web path, which the
 * builder drops because an entry URL is only ever routing input. A prefixed
 * deployment (`https://host/billing/`) serves `/v1/<intent>` beneath its own
 * prefix, so the origin alone would point at nothing.
 */
function underBase(base: URL, entry: URL): URL {
  const prefix = base.pathname.replace(/\/$/, '')
  return new URL(`${prefix}${entry.pathname}${entry.search}`, base.origin)
}

export function hostedBillingRoute(
  destination: HostedBillingDestination,
  intent: BillingIntent,
  billingWebBase: URL | null = getBillingWebUrl(),
  environment: BillingEnvironment | undefined = hostBillingEnvironment()
): HostedBillingRoute {
  if (destination !== 'billing_web' || !billingWebBase) return PROVIDER
  if (!environment || !resolveReturnTarget(RETURN_TO, environment)) {
    return PROVIDER
  }

  const entry = buildBillingEntryUrl({
    billingOrigin: billingWebBase,
    intent,
    product: PRODUCT,
    returnTo: RETURN_TO
  })
  return entry.status === 'ok'
    ? { kind: 'billing_web', url: underBase(billingWebBase, entry.url) }
    : PROVIDER
}
