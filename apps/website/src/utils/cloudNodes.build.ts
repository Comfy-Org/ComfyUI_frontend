import type { Pack } from '../data/cloudNodes'

import { fetchCloudNodesForBuild } from './cloudNodes'
import { reportCloudNodesOutcome } from './cloudNodes.ci'

/**
 * Resolve the list of packs to render at build time.
 *
 * Used by both the index page and the per-pack detail pages so that the
 * static index and the static detail routes are always derived from the
 * same source. `fetchCloudNodesForBuild` is memoized on a module-level
 * `inflight` promise, so repeated calls in the same build process share a
 * single network round-trip and the same outcome.
 */
export async function loadPacksForBuild(): Promise<Pack[]> {
  const outcome = await fetchCloudNodesForBuild()
  reportCloudNodesOutcome(outcome)

  if (outcome.status === 'failed') {
    throw new Error(
      `Cloud nodes fetch failed and no snapshot is available. Reason: ${outcome.reason}. ` +
        'Run `pnpm --filter @comfyorg/website cloud-nodes:refresh-snapshot` locally and commit the snapshot.'
    )
  }

  return outcome.snapshot.packs
}
