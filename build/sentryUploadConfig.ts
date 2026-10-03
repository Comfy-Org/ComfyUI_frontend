export interface SentryUploadConfig {
  authToken: string
  org: string
  projects: [string, string]
}

const REQUIRED_KEYS = [
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_PROJECT_PROD'
] as const

export function resolveSentryUploadConfig({
  distribution,
  isDev,
  env
}: {
  distribution: string
  isDev: boolean
  env: NodeJS.ProcessEnv
}): SentryUploadConfig | undefined {
  if (distribution !== 'cloud' || isDev) return

  const configuredKeys = REQUIRED_KEYS.filter((key) => Boolean(env[key]))
  if (configuredKeys.length === 0) return

  const missingKeys = REQUIRED_KEYS.filter((key) => !env[key])
  const authToken = env.SENTRY_AUTH_TOKEN
  const org = env.SENTRY_ORG
  const stagingProject = env.SENTRY_PROJECT
  const productionProject = env.SENTRY_PROJECT_PROD
  if (
    missingKeys.length > 0 ||
    !authToken ||
    !org ||
    !stagingProject ||
    !productionProject
  ) {
    throw new Error(
      `Incomplete Sentry source-map upload configuration: missing ${missingKeys.join(', ')}`
    )
  }

  if (stagingProject === productionProject) {
    throw new Error(
      'SENTRY_PROJECT and SENTRY_PROJECT_PROD must name different projects'
    )
  }

  return {
    authToken,
    org,
    projects: [stagingProject, productionProject]
  }
}
