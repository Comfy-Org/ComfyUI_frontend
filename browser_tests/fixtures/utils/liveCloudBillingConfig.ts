import { accessSync, constants, readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

import { z } from 'zod'

const absolutePath = z.string().refine(isAbsolute, 'Use an absolute path')
const origin = z
  .string()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === value
  }, 'Use an HTTPS origin without a path')

export const liveCloudBillingConfigSchema = z.object({
  baseURL: origin.refine((value) => {
    if (!URL.canParse(value)) return false
    const { hostname } = new URL(value)
    return (
      hostname === 'testcloud.comfy.org' ||
      hostname === 'stagingcloud.comfy.org' ||
      /^pr-\d+\.testenvs\.comfy\.org$/.test(hostname)
    )
  }, 'Use a Cloud test, staging, or PR preview deployment'),
  storageState: absolutePath,
  workspaceId: z.string().uuid(),
  resetScript: absolutePath,
  allowedOrigins: z
    .array(origin)
    .refine(
      (values) => !values.includes('https://cloud.comfy.org'),
      'Production Cloud is not a sandbox dependency'
    )
})

export function loadLiveCloudBillingConfig() {
  const path = process.env.CLOUD_BILLING_CONFIG
  if (!path) {
    throw new Error(
      'Set CLOUD_BILLING_CONFIG to a sandbox config. See docs/testing/cloud-billing-e2e.md.'
    )
  }
  const config = liveCloudBillingConfigSchema.parse(
    JSON.parse(readFileSync(path, 'utf8'))
  )
  accessSync(config.storageState, constants.R_OK)
  accessSync(config.resetScript, constants.X_OK)
  return config
}
