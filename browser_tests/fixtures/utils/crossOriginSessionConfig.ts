import { z } from 'zod'

const PRODUCTION_HOSTS = new Set([
  'cloud.comfy.org',
  'api.comfy.org',
  'billing.comfy.org',
  'platform.comfy.org'
])

export const FIREBASE_AUTH_ORIGINS = [
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com'
] as const

export function isComfyHost(hostname: string): boolean {
  return hostname === 'comfy.org' || hostname.endsWith('.comfy.org')
}

export function isProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(hostname)
}

const origin = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return url.href === `${url.origin}/`
  }, 'Use an origin without a path, query, credentials, or fragment')
  .transform((value) => new URL(value).origin)

const nonProductionComfyOrigin = origin.refine((value) => {
  const url = new URL(value)
  return (
    url.protocol === 'https:' &&
    isComfyHost(url.hostname) &&
    !isProductionHost(url.hostname)
  )
}, 'Use an https origin under comfy.org that is not production')

const upstream = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return ['localhost', '127.0.0.1'].includes(url.hostname)
  }, 'Use a local server, e.g. http://localhost:4321')
  .transform((value) => new URL(value).origin)

const originList = z
  .string()
  .transform((value) => value.split(',').map((entry) => entry.trim()))
  .pipe(z.array(origin))

const crossOriginSessionEnvSchema = z.object({
  SESSION_E2E_CLOUD_URL: nonProductionComfyOrigin.optional(),
  SESSION_E2E_WEBSITE_URL: nonProductionComfyOrigin.optional(),
  SESSION_E2E_WEBSITE_UPSTREAM: upstream.optional(),
  SESSION_E2E_BILLING_URL: nonProductionComfyOrigin.optional(),
  SESSION_E2E_BILLING_UPSTREAM: upstream.optional(),
  SESSION_E2E_PLATFORM_URL: nonProductionComfyOrigin.optional(),
  SESSION_E2E_EMAIL: z.string().email().optional(),
  SESSION_E2E_PASSWORD: z.string().min(1).optional(),
  SESSION_E2E_TEAM_WORKSPACE_ID: z.string().min(1).optional(),
  SESSION_E2E_EXTRA_ORIGINS: originList.optional()
})

export type CrossOriginSessionEnv = z.infer<typeof crossOriginSessionEnvSchema>

export type CrossOriginSessionEnvKey = keyof CrossOriginSessionEnv

export function parseCrossOriginSessionEnv(
  env: Record<string, string | undefined>
): CrossOriginSessionEnv {
  const present = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== '')
  )
  const result = crossOriginSessionEnvSchema.safeParse(present)
  if (!result.success) {
    throw new Error(
      `Invalid cross-origin session E2E env: ${result.error.issues
        .map((issue) => `${issue.path.join('.')} (${issue.message})`)
        .join(', ')}. See browser_tests/tests/crossOriginSession/README.md.`
    )
  }
  return result.data
}

export function missingSessionEnv(
  env: CrossOriginSessionEnv,
  keys: readonly CrossOriginSessionEnvKey[]
): CrossOriginSessionEnvKey[] {
  return keys.filter((key) => env[key] === undefined)
}

/** Origins served from a local upstream instead of the network. */
export function mappedOrigins(env: CrossOriginSessionEnv): Map<string, string> {
  const pairs: [string | undefined, string | undefined][] = [
    [env.SESSION_E2E_WEBSITE_URL, env.SESSION_E2E_WEBSITE_UPSTREAM],
    [env.SESSION_E2E_BILLING_URL, env.SESSION_E2E_BILLING_UPSTREAM]
  ]
  return new Map(
    pairs.flatMap(([siteOrigin, localOrigin]) =>
      siteOrigin && localOrigin ? [[siteOrigin, localOrigin]] : []
    )
  )
}

export function allowedOrigins(env: CrossOriginSessionEnv): Set<string> {
  return new Set([
    ...[
      env.SESSION_E2E_CLOUD_URL,
      env.SESSION_E2E_WEBSITE_URL,
      env.SESSION_E2E_BILLING_URL,
      env.SESSION_E2E_PLATFORM_URL
    ].flatMap((value) => (value ? [value] : [])),
    ...FIREBASE_AUTH_ORIGINS,
    ...(env.SESSION_E2E_EXTRA_ORIGINS ?? [])
  ])
}

/** Per-project options for playwright.session.config.ts. */
export type CrossOriginSessionOptions = { unifiedWebSession: boolean }
