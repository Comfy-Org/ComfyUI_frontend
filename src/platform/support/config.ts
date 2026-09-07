import { isCloud, isNightly } from '@/platform/distribution/types'

/**
 * Zendesk ticket form field IDs.
 */
const ZENDESK_FIELDS = {
  /** Distribution tag (cloud vs OSS) */
  DISTRIBUTION: 'tf_42243568391700',
  /** User email (anonymous requester) */
  ANONYMOUS_EMAIL: 'tf_anonymous_requester_email',
  /** User email (authenticated) */
  EMAIL: 'tf_40029135130388',
  /** User ID */
  USER_ID: 'tf_42515251051412'
} as const

/**
 * Gets the distribution identifier for tracking.
 * Helps distinguish feedback from different build types.
 */
function getDistribution(): 'ccloud' | 'oss-nightly' | 'oss' {
  if (isCloud) return 'ccloud'
  if (isNightly) return 'oss-nightly'
  return 'oss'
}

const SUPPORT_BASE_URL = 'https://support.comfy.org/hc/en-us/requests/new'

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
 * Builds the support URL with optional user information for pre-filling.
 * Users without login information will still get a valid support URL without pre-fill.
 *
 * @param params - User information to pre-fill in the support form
 * @returns Complete Zendesk support URL with query parameters
 */
export function buildSupportUrl(params?: {
  userEmail?: string | null
  userId?: string | null
}): string {
  const searchParams = new URLSearchParams({
    [ZENDESK_FIELDS.DISTRIBUTION]: getDistribution()
  })

  if (params?.userEmail) {
    searchParams.append(ZENDESK_FIELDS.ANONYMOUS_EMAIL, params.userEmail)
    searchParams.append(ZENDESK_FIELDS.EMAIL, params.userEmail)
  }
  if (params?.userId) {
    searchParams.append(ZENDESK_FIELDS.USER_ID, params.userId)
  }

  return `${SUPPORT_BASE_URL}?${searchParams.toString()}`
}
