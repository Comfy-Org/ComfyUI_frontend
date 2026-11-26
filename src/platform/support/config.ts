import { isCloud, isNightly } from '@/platform/distribution/types'
import { buildSupportFormUrl } from '@/utils/supportFormUrl'

/**
 * Gets the distribution identifier for tracking.
 * Helps distinguish feedback from different build types.
 */
function getDistribution(): 'ccloud' | 'oss-nightly' | 'oss' {
  if (isCloud) return 'ccloud'
  if (isNightly) return 'oss-nightly'
  return 'oss'
}

const SUPPORT_FORM_URLS = {
  billing:
    'https://comfysupport.portal.usepylon.com/forms/billing-refund-issue',
  bug: 'https://comfysupport.portal.usepylon.com/forms/report-a-bug',
  question: 'https://comfysupport.portal.usepylon.com/forms/question'
} as const

export type SupportForm = keyof typeof SUPPORT_FORM_URLS

export type FeedbackSource =
  | 'topbar'
  | 'action-bar'
  | 'help-center'
  | 'agent-panel'
  | 'agent-consent'

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

/** Builds the support form URL, pre-filled with the user's details when known. */
export function buildSupportUrl(
  form: SupportForm,
  identity?: { email?: string | null; userId?: string | null }
): string {
  return buildSupportFormUrl(SUPPORT_FORM_URLS[form], identity)
}
