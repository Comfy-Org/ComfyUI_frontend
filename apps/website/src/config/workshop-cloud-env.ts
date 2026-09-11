/**
 * The backend families the Workshop can be built against, shared by the
 * client-side switch (`workshop-env.ts`) and the build-time check
 * (`workshop-release.ts`) so both agree on the spelling.
 *
 * Each family is a Router origin, a Cloud origin and a Firebase project that
 * only trust each other; a token minted in one is meaningless in another.
 */
export const WORKSHOP_CLOUD_ENVS = ['prod', 'staging', 'test'] as const

export type WorkshopCloudEnv = (typeof WORKSHOP_CLOUD_ENVS)[number]

export function isWorkshopCloudEnv(
  value: string | undefined
): value is WorkshopCloudEnv {
  return WORKSHOP_CLOUD_ENVS.some((env) => env === value)
}

/**
 * Unset means staging, so local development needs no configuration and
 * lands on a family that cannot touch production. Deployed builds that include
 * Workshop never rely on this default: `assertWorkshopCloudEnvForBuild` makes
 * them name a family and rejects anything misspelt before the build starts.
 */
export function resolveWorkshopCloudEnv(
  value: string | undefined
): WorkshopCloudEnv {
  return isWorkshopCloudEnv(value) ? value : 'staging'
}
