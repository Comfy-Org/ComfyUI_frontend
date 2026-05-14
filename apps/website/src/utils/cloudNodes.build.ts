import { isAbsolute, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { Pack } from '../data/cloudNodes'

import { fetchCloudNodesForBuild } from './cloudNodes'
import { reportCloudNodesOutcome } from './cloudNodes.ci'

const REFRESH_HINT =
  'Run `pnpm --filter @comfyorg/website cloud-nodes:refresh-snapshot` locally and commit the snapshot, ' +
  'or re-run the `Release: Website` workflow with a valid WEBSITE_CLOUD_API_KEY.'

const WEBSITE_PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url))

function isProductionBuild(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

function fixtureSnapshotUrl(): URL | undefined {
  const fixturePath = process.env.WEBSITE_CLOUD_NODES_FIXTURE
  if (!fixturePath) return undefined
  const absolute = isAbsolute(fixturePath)
    ? fixturePath
    : resolvePath(WEBSITE_PACKAGE_ROOT, fixturePath)
  return pathToFileURL(absolute)
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
 *
 * Setting `WEBSITE_CLOUD_NODES_FIXTURE=<path>` overrides the bundled
 * snapshot with a fixture file on disk. This is used by the e2e build
 * step in CI so Playwright assertions can be written against deterministic
 * pack content instead of whatever the upstream registry happens to expose
 * at the moment of the test run. The override never fires the live cloud
 * API; the fixture path goes straight to the snapshot-fallback branch.
 */
export async function loadPacksForBuild(): Promise<Pack[]> {
  const snapshotUrl = fixtureSnapshotUrl()
  const options = snapshotUrl ? { snapshotUrl, apiKey: '' } : {}
  const outcome = await fetchCloudNodesForBuild(options)
  reportCloudNodesOutcome(outcome)

  if (outcome.status === 'failed') {
    throw new Error(
      `Cloud nodes fetch failed and no snapshot is available. Reason: ${outcome.reason}. ${REFRESH_HINT}`
    )
  }

  if (outcome.status === 'stale' && isProductionBuild() && !snapshotUrl) {
    throw new Error(
      `Cloud nodes fetch returned stale data in a production build (VERCEL_ENV=production). ` +
        `Reason: ${outcome.reason}. ${REFRESH_HINT}`
    )
  }

  return outcome.snapshot.packs
}
