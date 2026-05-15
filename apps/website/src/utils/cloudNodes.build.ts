import { isAbsolute, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { Pack } from '../data/cloudNodes'

import { fetchCloudNodesForBuild } from './cloudNodes'
import { reportCloudNodesOutcome } from './cloudNodes.ci'

const REFRESH_HINT =
  'Run `pnpm --filter @comfyorg/website cloud-nodes:refresh-snapshot` locally and commit the snapshot, ' +
  'or re-run the `Release: Website` workflow with a valid WEBSITE_CLOUD_API_KEY.'

const WEBSITE_PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Determine whether the current build is a production Vercel deployment.
 *
 * @returns `true` if `process.env.VERCEL_ENV` is exactly `'production'`, `false` otherwise.
 */
function isProductionBuild(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

/**
 * Produces a file:// URL pointing to a local fixture snapshot when WEBSITE_CLOUD_NODES_FIXTURE is set.
 *
 * @returns A `URL` for the resolved fixture path, or `undefined` if the environment variable is not set.
 */
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
 * The same resolved snapshot is used to derive both the site index and per-pack detail routes so static pages share a single source of truth. In production builds a stale snapshot causes the build to fail unless a local fixture override is provided via the `WEBSITE_CLOUD_NODES_FIXTURE` environment variable, which forces use of the on-disk snapshot instead of the live cloud API.
 *
 * @returns The array of `Pack` objects from the resolved snapshot to render at build time.
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
