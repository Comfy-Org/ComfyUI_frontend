/**
 * Deep links into the cloud app, the one host every checkout can fall back
 * to. Each opens in the workspace billing acted on, as a return URL does, so
 * the host lands on that workspace rather than its last-used one.
 */
import { CLOUD_BASE_URL } from '@/config/env'

/** What a return URL names the billed workspace under; see `buildReturnUrl`. */
const WORKSPACE_PARAM = 'workspace'

function cloudDeepLink(
  params: Readonly<Record<string, string>>,
  workspaceId: string | undefined
): string {
  const url = new URL('/', CLOUD_BASE_URL)
  for (const [name, value] of Object.entries(params))
    url.searchParams.set(name, value)
  if (workspaceId !== undefined)
    url.searchParams.set(WORKSPACE_PARAM, workspaceId)
  return url.href
}

/** The pricing table, opened on the Team tab for a link that asked for a team plan. */
export function pricingTableUrl(
  tab: 'team' | 'default',
  workspaceId: string | undefined
): string {
  return cloudDeepLink({ pricing: tab === 'team' ? 'team' : '1' }, workspaceId)
}

/** The Plan & Credits settings panel: where checkout returns when the link named nowhere to go back to. */
export function planCreditsSettingsUrl(
  workspaceId: string | undefined
): string {
  return cloudDeepLink({ settings: 'plan-credits' }, workspaceId)
}
