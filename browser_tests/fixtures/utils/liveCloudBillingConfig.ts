import { z } from 'zod'

const sandboxURL = z
  .string()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.href === `${url.origin}/` &&
      (url.hostname === 'testcloud.comfy.org' ||
        url.hostname === 'stagingcloud.comfy.org' ||
        /^pr-\d+\.testenvs\.comfy\.org$/.test(url.hostname))
    )
  }, 'Use a Cloud test, staging, or PR preview origin')
  .transform((value) => new URL(value).origin)

export const liveCloudBillingConfigSchema = z
  .object({
    PLAYWRIGHT_TEST_URL: z
      .string()
      .url()
      .refine((value) => {
        if (!URL.canParse(value)) return false
        const url = new URL(value)
        return url.href === `${url.origin}/`
      }, 'Use an origin without a path, query, credentials, or fragment')
      .transform((value) => new URL(value).origin),
    PLAYWRIGHT_SETUP_API_URL: sandboxURL,
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
