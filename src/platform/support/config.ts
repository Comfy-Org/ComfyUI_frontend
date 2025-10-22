import { isCloud } from '@/platform/distribution/types'

/**
 * Support URLs for the ComfyUI platform.
 * The URL varies based on whether the application is running in Cloud or OSS distribution.
 *
 * - Cloud: Includes 'ccloud' tag for identifying cloud-based support requests
 * - OSS: Includes 'oss' tag for identifying open-source support requests
 */
const TAG = isCloud ? 'ccloud' : 'oss'
export const SUPPORT_URL = `https://support.comfy.org/hc/en-us/requests/new?tf_42243568391700=${TAG}`
