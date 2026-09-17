/**
 * Where billing is allowed to send a customer back to. A closed registry, not
 * a caller-supplied URL: `return_to=<identifier>` names a target, and the
 * absolute destination is chosen here per environment, so a crafted entry URL
 * cannot turn the hosted app into an open redirect.
 *
 * Every destination below is one this repository already states. A family a
 * target has no confirmed origin for stays absent rather than being derived
 * from a sibling's hostname, because an unresolvable target fails closed while
 * a guessed one sends a customer somewhere nobody serves.
 *
 * Localhost and desktop return targets are out of scope: a developer running a
 * product locally returns to the deployed destination of whichever environment
 * their backend belongs to.
 */
import type { BillingEnvironment } from './contract.js'
import { parseUrl } from './url.js'

export const RETURN_TARGETS = [
  'comfyui_workspace',
  'comfyui_credits',
  'platform_account'
] as const

export type ReturnTarget = (typeof RETURN_TARGETS)[number]

type ReturnTargetDestinations = Readonly<
  Partial<Record<BillingEnvironment, string>>
>

const RETURN_TARGET_DESTINATIONS: Readonly<
  Record<ReturnTarget, ReturnTargetDestinations>
> = {
  comfyui_workspace: {
    production: 'https://cloud.comfy.org/',
    staging: 'https://stagingcloud.comfy.org/',
    test: 'https://testcloud.comfy.org/'
  },
  // The cloud app's credits settings page, the same URL the Workshop builds as
  // `WORKSHOP_CREDITS_URL`.
  comfyui_credits: {
    production: 'https://cloud.comfy.org/?settings=plan-credits',
    staging: 'https://stagingcloud.comfy.org/?settings=plan-credits',
    test: 'https://testcloud.comfy.org/?settings=plan-credits'
  },
  // Platform lives in its own repository and names no account route here, so
  // its origin root is the destination until that app names one.
  platform_account: {
    production: 'https://platform.comfy.org/',
    staging: 'https://stagingplatform.comfy.org/'
  }
}

export function isReturnTarget(value: string): value is ReturnTarget {
  return RETURN_TARGETS.some((target) => target === value)
}

/**
 * Undefined for an identifier outside the registry, and for a registered
 * target that has no destination in the requested environment. Each call
 * returns a fresh `URL` so a caller can append to it without editing the
 * registry.
 */
export function resolveReturnTarget(
  target: string,
  environment: BillingEnvironment
): URL | undefined {
  if (!isReturnTarget(target)) return undefined

  const destination = RETURN_TARGET_DESTINATIONS[target][environment]
  return destination === undefined ? undefined : parseUrl(destination)
}
