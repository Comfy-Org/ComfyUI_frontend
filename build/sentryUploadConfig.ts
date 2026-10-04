const REQUIRED_KEYS = [
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_PROJECT_PROD'
]

export function hasCompleteSentryUploadConfig(env: NodeJS.ProcessEnv) {
  return REQUIRED_KEYS.every((key) => Boolean(env[key]))
}

export function resolveSentryUploadConfig({
  distribution,
  isDev,
  env
}: {
  distribution: 'desktop' | 'localhost' | 'cloud'
  isDev: boolean
  env: NodeJS.ProcessEnv
}) {
  if (distribution !== 'cloud' || isDev) return

  const missingKeys = REQUIRED_KEYS.filter((key) => !env[key])
  if (missingKeys.length === REQUIRED_KEYS.length) return

  const authToken = env.SENTRY_AUTH_TOKEN
  const org = env.SENTRY_ORG
  const stagingProject = env.SENTRY_PROJECT
  const productionProject = env.SENTRY_PROJECT_PROD
  if (!authToken || !org || !stagingProject || !productionProject) {
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
    project: [stagingProject, productionProject]
  }
}
