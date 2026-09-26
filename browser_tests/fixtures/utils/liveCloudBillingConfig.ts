import { z } from 'zod'

const originURL = z
  .string()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return url.href === `${url.origin}/`
  }, 'Use an origin without a path, query, credentials, or fragment')
  .transform((value) => new URL(value).origin)

export function getLiveCloudEnvironment(cloudOrigin: string) {
  const production = cloudOrigin === 'https://cloud.comfy.org'
  const customerOrigin =
    cloudOrigin === 'https://cloud.comfy.org'
      ? 'https://api.comfy.org'
      : cloudOrigin === 'https://testcloud.comfy.org'
        ? 'https://testapi.comfy.org'
        : cloudOrigin === 'https://stagingcloud.comfy.org'
          ? 'https://stagingapi.comfy.org'
          : /^https:\/\/pr-\d+\.testenvs\.comfy\.org$/.test(cloudOrigin)
            ? cloudOrigin.replace('.testenvs.', '-registry.testenvs.')
            : undefined
  if (!customerOrigin) throw new Error('Unsupported Cloud environment')
  const stripeMode: 'live' | 'test' = production ? 'live' : 'test'
  return {
    customerOrigin,
    stripeMode,
    firebaseOrigin: production
      ? 'https://dreamboothy.firebaseapp.com'
      : 'https://dreamboothy-dev.firebaseapp.com'
  }
}

export const liveCloudBillingConfigSchema = z
  .object({
    PLAYWRIGHT_TEST_URL: originURL,
    PLAYWRIGHT_SETUP_API_URL: originURL.default(
      'https://stagingcloud.comfy.org'
    ),
    CLOUD_ACCOUNT_EMAIL: z.string().email().optional(),
    CLOUD_ACCOUNT_PASSWORD: z.string().min(1).optional(),
    allowCheckout: z.boolean().default(false),
    allowPayments: z.boolean().default(false),
    allowAccountCreation: z.boolean().default(false)
  })
  .superRefine((config, ctx) => {
    if (
      (config.allowPayments || config.allowAccountCreation) &&
      config.PLAYWRIGHT_SETUP_API_URL === 'https://cloud.comfy.org'
    )
      ctx.addIssue({
        code: 'custom',
        path: ['PLAYWRIGHT_SETUP_API_URL'],
        message: 'Payment tests require a sandbox Cloud backend'
      })
    if (!config.allowAccountCreation) {
      for (const field of [
        'CLOUD_ACCOUNT_EMAIL',
        'CLOUD_ACCOUNT_PASSWORD'
      ] as const) {
        if (!config[field])
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Required for permanent-account tests'
          })
      }
    }
  })
  .superRefine((config, ctx) => {
    if (!URL.canParse(config.PLAYWRIGHT_TEST_URL)) return
    const frontend = new URL(config.PLAYWRIGHT_TEST_URL)
    const local =
      ['localhost', '127.0.0.1'].includes(frontend.hostname) &&
      ['http:', 'https:'].includes(frontend.protocol)
    if (
      !local &&
      config.PLAYWRIGHT_TEST_URL !== config.PLAYWRIGHT_SETUP_API_URL
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['PLAYWRIGHT_TEST_URL'],
        message: 'Use localhost or the selected Cloud origin'
      })
    }
  })
  .transform((config, ctx) => {
    try {
      const environment = getLiveCloudEnvironment(
        config.PLAYWRIGHT_SETUP_API_URL
      )
      return {
        ...config,
        customerOrigin: environment.customerOrigin,
        environment
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['PLAYWRIGHT_SETUP_API_URL'],
        message: 'Use a Cloud production, staging, test, or PR preview origin'
      })
      return z.NEVER
    }
  })

export type LiveCloudBillingConfig = z.infer<
  typeof liveCloudBillingConfigSchema
>

export function loadLiveCloudBillingConfig(
  options: {
    allowPayments?: boolean
    allowAccountCreation?: boolean
    allowCheckout?: boolean
  } = {}
) {
  const result = liveCloudBillingConfigSchema.safeParse({
    ...process.env,
    ...options
  })
  if (!result.success) {
    throw new Error(
      `Cloud billing prerequisites: ${result.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}. See docs/testing/cloud-billing-e2e.md.`
    )
  }
  return result.data
}
