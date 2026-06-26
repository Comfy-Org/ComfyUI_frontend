import type { Pack } from '../data/cloudNodes'

import { fetchCloudNodesForBuild } from './cloudNodes'
import { reportCloudNodesOutcome } from './cloudNodes.ci'

const REFRESH_HINT =
  'Run `pnpm --filter @comfyorg/website cloud-nodes:refresh-snapshot` locally and commit the snapshot, ' +
  'or re-run the `Release: Website` workflow with a valid WEBSITE_CLOUD_API_KEY.'

function isProductionBuild(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

/**
 * Resolve the list of packs to render at build time.
 *
 * Used by both the index page and the per-pack detail pages so that the
 * static index and the static detail routes are always derived from the
 * same source. `fetchCloudNodesForBuild` is memoized on a module-level
 * `inflight` promise, so repeated calls in the same build process share a
 * single network round-trip and the same outcome.
 *
 * Production builds (VERCEL_ENV=production) fail hard on a stale outcome
 * to prevent silently shipping out-of-date snapshot data. Preview and
 * local builds continue to use the committed snapshot.
 */
export async function loadPacksForBuild(): Promise<Pack[]> {
  const outcome = await fetchCloudNodesForBuild()
  reportCloudNodesOutcome(outcome)

  if (outcome.status === 'failed') {
    throw new Error(
      `Cloud nodes fetch failed and no snapshot is available. Reason: ${outcome.reason}. ${REFRESH_HINT}`
    )
  }

  if (outcome.status === 'stale' && isProductionBuild()) {
    throw new Error(
      `Cloud nodes fetch returned stale data in a production build (VERCEL_ENV=production). ` +
        `Reason: ${outcome.reason}. ${REFRESH_HINT}`
    )
  }

  return outcome.snapshot.packs
}
