import { isCloud, isNightly } from '@/platform/distribution/types'

/**
 * Slug of a Pylon form under https://portal.usepylon.com/comfy-org/forms/.
 * The form slug determines which ticket form opens and which fields are shown.
 */
export const SupportForm = {
  Billing: 'billing-refund-issue',
  Bug: 'report-a-bug',
  FeatureRequest: 'feature-request',
  PartnerNode: 'partner-node-issue',
  Question: 'question'
} as const
export type SupportForm = (typeof SupportForm)[keyof typeof SupportForm]

/**
 * Pylon custom-field slugs (URL keys) configured for the comfy-org workspace.
 * Pylon prefill uses the slug — not the field UUID — as the URL key.
 */
const PYLON_FIELDS = {
  EMAIL: 'email',
  BROWSER: 'browser',
  COMFY_CLOUD_USER_ID: 'comfy_cloud_user_id',
  COMFY_ENVIRONMENT: 'comfy_environment',
  COMFY_OS: 'comfy_os',
  COMFY_VERSION: 'comfy_version',
  PRODUCT_AREA: 'product_area'
} as const

const PYLON_FORMS_BASE_URL = 'https://portal.usepylon.com/comfy-org/forms/'
const FEEDBACK_TYPEFORM_BASE_URL = 'https://form.typeform.com/to/q7azbWPi'

/**
 * Build environment tag for distinguishing tickets by build type.
 */
function getEnvironment(): 'ccloud' | 'oss-nightly' | 'oss' {
  if (isCloud) return 'ccloud'
  if (isNightly) return 'oss-nightly'
  return 'oss'
}

/**
 * Builds the feedback Typeform URL tagged with the current build environment
 * and the UI source that opened it. Tags are passed via the URL fragment
 * (Typeform's hidden-field convention) so survey responses can be segmented
 * by environment (cloud / oss-nightly / oss) and entry point.
 */
export function buildFeedbackTypeformUrl(
  source: 'topbar' | 'action-bar' | 'help-center'
): string {
  const params = new URLSearchParams({
    distribution: getEnvironment(),
    source
  })
  return `${FEEDBACK_TYPEFORM_BASE_URL}#${params.toString()}`
}

export interface SupportPrefill {
  /** Authenticated user's email (for Cloud / API-key users). */
  userEmail?: string | null
  /** Cloud user id, when available. */
  userId?: string | null
  /** Operating system string (e.g. "macOS 14.5"). */
  os?: string | null
  /** ComfyUI frontend version. */
  version?: string | null
  /** Product area this ticket belongs to (e.g. "Billing", "Cloud"). */
  productArea?: string | null
}

/**
 * Encode a single `slug=value` pair. Skips empty values so the resulting URL
 * stays clean. We use `encodeURIComponent` (not `URLSearchParams`) so spaces
 * become `%20` rather than `+`, matching the Pylon prefill spec.
 */
function encodePair(
  slug: string,
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === '') return null
  return `${encodeURIComponent(slug)}=${encodeURIComponent(value)}`
}

function detectBrowser(): string | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  // Order matters: Edge / Opera identify themselves as Chrome too.
  const matchers: { name: string; pattern: RegExp }[] = [
    { name: 'Edge', pattern: /Edg\/([\d.]+)/ },
    { name: 'Opera', pattern: /OPR\/([\d.]+)/ },
    { name: 'Chrome', pattern: /Chrome\/([\d.]+)/ },
    { name: 'Firefox', pattern: /Firefox\/([\d.]+)/ },
    { name: 'Safari', pattern: /Version\/([\d.]+).*Safari/ }
  ]
  for (const { name, pattern } of matchers) {
    const match = ua.match(pattern)
    if (match) return `${name} ${match[1].split('.')[0]}`
  }
  return null
}

/**
 * Derive a user-friendly OS string from the browser. Preferred over backend
 * platform names like `darwin` / `win32` because those are kernel identifiers,
 * not what users (or support agents) recognize. Modern browsers freeze the
 * macOS / Windows minor version in the UA string, so we only report the
 * family — that's still more useful than `darwin`.
 */
export function detectOS(): string | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent

  if (/iPad|iPhone|iPod/.test(ua)) {
    const iOS = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/)
    return iOS ? `iOS ${iOS[1]}.${iOS[2]}${iOS[3] ? `.${iOS[3]}` : ''}` : 'iOS'
  }
  if (/Android/.test(ua)) {
    const android = ua.match(/Android (\d+(?:\.\d+)*)/)
    return android ? `Android ${android[1]}` : 'Android'
  }
  if (/Mac OS X|Macintosh/.test(ua)) {
    const mac = ua.match(/Mac OS X (\d+)[._](\d+)(?:[._](\d+))?/)
    if (!mac) return 'macOS'
    return `macOS ${mac[1]}.${mac[2]}${mac[3] ? `.${mac[3]}` : ''}`
  }
  if (/Windows NT/.test(ua)) {
    const win = ua.match(/Windows NT (\d+\.\d+)/)
    const winMap: Record<string, string> = {
      '10.0': 'Windows 10/11',
      '6.3': 'Windows 8.1',
      '6.2': 'Windows 8',
      '6.1': 'Windows 7'
    }
    return win ? (winMap[win[1]] ?? `Windows NT ${win[1]}`) : 'Windows'
  }
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Linux/.test(ua)) return 'Linux'

  return null
}

/**
 * Backend (`systemStats.system.os`) reports the Python platform identifier
 * for OSS / Desktop, which is the kernel name (`darwin`, `linux`, `win32`).
 * Promote those to the UA-detected version so the Pylon ticket shows
 * "macOS 14.5" instead of "darwin".
 */
export function normalizeOsName(
  rawOs: string | null | undefined
): string | null {
  const uaOs = detectOS()
  if (!rawOs) return uaOs
  const lower = rawOs.toLowerCase().trim()
  if (lower === 'darwin' || lower === 'linux' || lower === 'win32') {
    return uaOs ?? rawOs
  }
  return rawOs
}

/**
 * Builds the Pylon prefill URL for a given form, omitting empty fields.
 * Users without prefill data still get a valid URL that opens the same form —
 * Pylon will collect those values from the user manually.
 *
 * @param form - Which Pylon form to open
 * @param prefill - Field values to pre-populate
 * @returns Complete Pylon form URL
 */
export function buildSupportUrl(
  form: SupportForm = SupportForm.Question,
  prefill: SupportPrefill = {}
): string {
  const pairs: string[] = []
  const push = (slug: string, value: string | null | undefined) => {
    const pair = encodePair(slug, value)
    if (pair) pairs.push(pair)
  }

  push(PYLON_FIELDS.EMAIL, prefill.userEmail)
  push(PYLON_FIELDS.COMFY_CLOUD_USER_ID, prefill.userId)
  push(PYLON_FIELDS.COMFY_ENVIRONMENT, getEnvironment())
  push(PYLON_FIELDS.COMFY_VERSION, prefill.version)
  push(PYLON_FIELDS.COMFY_OS, prefill.os)
  push(PYLON_FIELDS.BROWSER, detectBrowser())
  push(PYLON_FIELDS.PRODUCT_AREA, prefill.productArea)

  const query = pairs.join('&')
  return `${PYLON_FORMS_BASE_URL}${form}${query ? `?${query}` : ''}`
}
