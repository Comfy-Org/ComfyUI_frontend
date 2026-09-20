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

function getLiveCloudCustomerOrigin(cloudOrigin: string): string | undefined {
  if (cloudOrigin === 'https://testcloud.comfy.org')
    return 'https://testapi.comfy.org'
  if (cloudOrigin === 'https://stagingcloud.comfy.org')
    return 'https://stagingapi.comfy.org'
  if (/^https:\/\/pr-\d+\.testenvs\.comfy\.org$/.test(cloudOrigin)) {
    return cloudOrigin.replace('.testenvs.', '-registry.testenvs.')
  }
}

export const liveCloudBillingConfigSchema = z
  .object({
    PLAYWRIGHT_TEST_URL: originURL,
    PLAYWRIGHT_SETUP_API_URL: originURL,
    CLOUD_ACCOUNT_EMAIL: z.string().email(),
    CLOUD_ACCOUNT_PASSWORD: z.string().min(1)
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
        message: 'Use localhost or the selected sandbox origin'
      })
    }
  })
  .transform((config, ctx) => {
    const customerOrigin = getLiveCloudCustomerOrigin(
      config.PLAYWRIGHT_SETUP_API_URL
    )
    if (!customerOrigin) {
      ctx.addIssue({
        code: 'custom',
        path: ['PLAYWRIGHT_SETUP_API_URL'],
        message: 'Use a Cloud test, staging, or PR preview origin'
      })
      return z.NEVER
    }
    return { ...config, customerOrigin }
  })

export type LiveCloudBillingConfig = z.infer<
  typeof liveCloudBillingConfigSchema
>

export function loadLiveCloudBillingConfig() {
  const result = liveCloudBillingConfigSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(
      `Cloud billing prerequisites: ${result.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}. See docs/testing/cloud-billing-e2e.md.`
    )
  }
  return result.data
}
