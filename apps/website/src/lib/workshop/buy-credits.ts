import {
  WORKSHOP_CLOUD_ENV,
  WORKSHOP_CREDITS_URL
} from '../../config/workshop-env'

/**
 * The MVP rail (DES-1015): buying happens on platform.comfy.org, in a new
 * tab so the model page and its inputs stay alive. The workspace travels as
 * the server-resolved id — comfy.org and platform keep separate switchers,
 * and without it a buyer can top up the wallet that is not the empty one.
 * The parameter name is the shape agreed for platform's deep-link work, not
 * yet its confirmed contract.
 *
 * Platform billing exists only against production Cloud. The lower families
 * keep the visitor on their own cloud's credits page, so a preview can never
 * hand a staging workspace id to production billing.
 */
const PLATFORM_ORIGIN = 'https://platform.comfy.org'

export const TOP_UP_ON_PLATFORM = WORKSHOP_CLOUD_ENV === 'prod'

export function platformTopUpHref(workspaceId?: string): string {
  if (WORKSHOP_CLOUD_ENV !== 'prod') return WORKSHOP_CREDITS_URL
  const url = new URL('/billing', PLATFORM_ORIGIN)
  if (workspaceId) url.searchParams.set('workspace', workspaceId)
  return url.toString()
}
