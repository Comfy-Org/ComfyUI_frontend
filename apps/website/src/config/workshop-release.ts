/**
 * Whether Workshop is built into the site at all.
 *
 * Three environments, and only one of them has Workshop in it:
 *
 * | Environment      | `VERCEL_ENV` | Workshop | What it answers                |
 * | ---------------- | ------------ | -------- | ------------------------------ |
 * | Production       | `production` | out      | what is on comfy.org right now |
 * | Preview, staging | `preview`    | out      | what ships if we release today |
 * | Development      | unset        | in       | what we are building           |
 *
 * Preview and production must agree. A preview whose contents differ from the
 * next release cannot answer the only question a preview is for — if we cut a
 * release right now, for a hotfix say, what goes out? Workshop is unfinished,
 * so the answer has to be "not Workshop", and it has to be true on both.
 *
 * `noindex` cannot do this job. It asks a crawler to stay away; the page is
 * still live at a URL anyone can share. Keeping the routes out of the build is
 * the only thing that actually holds.
 *
 * So a deployed build excludes Workshop unless it is explicitly asked for.
 * Local development includes it, because that is where it is being built and
 * nothing there ships.
 *
 * `WORKSHOP_IN_BUILD` overrides both ways, and is how the other two
 * environments are reached without a code change:
 *
 * - `1` — put Workshop in. Set by CI on a PR labelled `workshop`, which is how
 *   the feature gets a review URL; and set in the production environment on
 *   the day Workshop launches.
 * - `0` — keep it out. Reproduces a release build locally.
 */

import type { WorkshopCloudEnv } from './workshop-cloud-env'
import { WORKSHOP_CLOUD_ENVS, isWorkshopCloudEnv } from './workshop-cloud-env'

/** Environments whose builds are deployed somewhere people can reach. */
const DEPLOYED = new Set(['production', 'preview'])

export function isWorkshopInBuild(): boolean {
  const override = process.env.WORKSHOP_IN_BUILD
  if (override === '1') return true
  if (override === '0') return false

  return !DEPLOYED.has(process.env.VERCEL_ENV ?? '')
}

/** Every route Workshop owns. Kept here so the gate has one definition. */
export function isWorkshopRoute(pattern: string): boolean {
  const pathname = pattern.replace(/\/$/, '')
  // /models itself is the established marketing page when the gate is off.
  return isLegacyWorkshopRoute(pathname) || pathname.startsWith('/models/')
}

export function isLegacyWorkshopRoute(pattern: string): boolean {
  const pathname = pattern.replace(/\/$/, '')
  return pathname === '/workshop' || pathname.startsWith('/workshop/')
}

/**
 * Which backend families a deployed build may point Workshop at.
 *
 * The backends' CORS allowlists pair each origin with one family — comfy.org
 * with production Cloud, a Vercel preview with staging or test (cloud
 * FE-2009) — so this is not a preference, it is what will work.
 */
function allowedFamiliesFor(
  vercelEnv: string
): readonly WorkshopCloudEnv[] | undefined {
  switch (vercelEnv) {
    case 'production':
      return ['prod']
    case 'preview':
      return ['staging', 'test']
    default:
      return undefined
  }
}

/**
 * A build that ships with Workshop in it must name its backend family, and
 * name one its origin is allowed to reach. Anything else fails here, at build
 * time, rather than as a preflight error in a visitor's browser.
 *
 * Local builds keep the staging default (see `workshop-env.ts`), and a build
 * without Workshop in it has nothing to point anywhere and is left alone — so
 * production builds are untouched until the day Workshop launches, when
 * `PUBLIC_WORKSHOP_CLOUD_ENV=prod` goes in alongside `WORKSHOP_IN_BUILD=1`.
 */
export function assertWorkshopCloudEnvForBuild(): void {
  if (!isWorkshopInBuild()) return

  const raw = process.env.PUBLIC_WORKSHOP_CLOUD_ENV
  const family = raw === undefined || raw === '' ? undefined : raw
  if (family !== undefined && !isWorkshopCloudEnv(family)) {
    throw new Error(
      `PUBLIC_WORKSHOP_CLOUD_ENV=${JSON.stringify(family)} is not one of ${WORKSHOP_CLOUD_ENVS.join(', ')}.`
    )
  }
  const vercelEnv = process.env.VERCEL_ENV ?? ''
  const allowed = allowedFamiliesFor(vercelEnv)
  if (!allowed) return

  const choices = allowed.join(' or ')
  if (family === undefined) {
    throw new Error(
      `Workshop is in this ${vercelEnv} build but PUBLIC_WORKSHOP_CLOUD_ENV is unset. Set it to ${choices} in the Vercel ${vercelEnv} environment.`
    )
  }
  if (!allowed.includes(family)) {
    throw new Error(
      `PUBLIC_WORKSHOP_CLOUD_ENV=${family} is not allowed for a ${vercelEnv} build: this origin may only reach ${choices} Cloud (ingest CORS_ORIGIN, cloud FE-2009).`
    )
  }
}
