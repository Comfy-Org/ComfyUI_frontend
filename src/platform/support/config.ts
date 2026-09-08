import { isCloud, isDesktop, isNightly } from '@/platform/distribution/types'

/**
 * Gets the distribution identifier for tracking.
 * Helps distinguish feedback from different build types.
 */
function getDistribution(): 'ccloud' | 'oss-nightly' | 'oss' {
  if (isCloud) return 'ccloud'
  if (isNightly) return 'oss-nightly'
  return 'oss'
}

const SUPPORT_BASE_URL = 'https://comfy-org.portal.usepylon.com/forms/question'

/**
 * Separate from `getDistribution()`, whose tags feed feedback segmentation.
 * The bridge check is load-bearing, not redundant: the shipping Desktop app
 * loads the ordinary `dist.zip`, so `isDesktop` is false there.
 */
function getPylonComfyEnvironment():
  | 'comfy_cloud'
  | 'comfy_desktop_install'
  | 'local_comfyui_oss' {
  if (isCloud) return 'comfy_cloud'
  if (isDesktop || !!window.__comfyDesktop2) return 'comfy_desktop_install'
  return 'local_comfyui_oss'
}

export type FeedbackSource = 'topbar' | 'action-bar' | 'help-center'

export const FEEDBACK_TYPEFORM_ID = 'q7azbWPi'

const FEEDBACK_TYPEFORM_BASE_URL = `https://form.typeform.com/to/${FEEDBACK_TYPEFORM_ID}`

/** Shared by the URL and embed builders so their segmentation tags can't drift. */
function getFeedbackTags(source: FeedbackSource): Record<string, string> {
  return { distribution: getDistribution(), source }
}

/**
 * Builds the feedback Typeform URL tagged with the current build distribution
 * and the UI source that opened it. Tags are passed via the URL fragment
 * (Typeform's hidden-field convention) so survey responses can be segmented
 * by distribution (cloud / oss-nightly / oss) and entry point.
 */
export function buildFeedbackTypeformUrl(source: FeedbackSource): string {
  const params = new URLSearchParams(getFeedbackTags(source))
  return `${FEEDBACK_TYPEFORM_BASE_URL}#${params.toString()}`
}

export function buildFeedbackHiddenFields(
  source: FeedbackSource,
  extraTags: Record<string, string> = {}
): string {
  // Typeform's `data-tf-hidden` parser (transformRecord) splits on `,` and
  // unescapes `\,`, so a comma in a value is the only delimiter that needs escaping.
  return Object.entries({ ...getFeedbackTags(source), ...extraTags })
    .map(([key, value]) => `${key}=${value.replace(/,/g, '\\,')}`)
    .join(',')
}

/**
 * Builds the Pylon support form URL. Pylon prefills a field from a query
 * parameter keyed by that field's slug, so signed-in users get their name and
 * email filled in and every ticket carries the running Comfy environment.
 */
export function buildSupportUrl(params?: {
  userEmail?: string | null
  userDisplayName?: string | null
}): string {
  const searchParams = new URLSearchParams({
    comfy_environment: getPylonComfyEnvironment()
  })

  if (params?.userDisplayName)
    searchParams.append('name', params.userDisplayName)
  if (params?.userEmail) searchParams.append('email', params.userEmail)

  return `${SUPPORT_BASE_URL}?${searchParams.toString()}`
}
