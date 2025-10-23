import { isCloud } from '@/platform/distribution/types'

/**
 * Zendesk ticket form field ID for the distribution tag.
 * This field is used to categorize support requests by their source (cloud vs OSS).
 */
const DISTRIBUTION_FIELD_ID = 'tf_42243568391700'

/**
 * Support URLs for the ComfyUI platform.
 * The URL varies based on whether the application is running in Cloud or OSS distribution.
 *
 * - Cloud: Includes 'ccloud' tag for identifying cloud-based support requests
 * - OSS: Includes 'oss' tag for identifying open-source support requests
 */
const TAG = isCloud ? 'ccloud' : 'oss'
export const SUPPORT_URL = `https://support.comfy.org/hc/en-us/requests/new?${DISTRIBUTION_FIELD_ID}=${TAG}`
