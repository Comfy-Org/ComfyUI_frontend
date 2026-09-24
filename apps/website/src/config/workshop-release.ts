import type { WorkshopCloudEnv } from './workshop-cloud-env'
import { WORKSHOP_CLOUD_ENVS, isWorkshopCloudEnv } from './workshop-cloud-env'

export function isWorkshopInBuild(): boolean {
  return process.env.WORKSHOP_IN_BUILD !== '0'
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
