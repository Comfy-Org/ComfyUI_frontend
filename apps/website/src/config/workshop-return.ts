import type {
  WorkshopField,
  WorkshopFormValue,
  WorkshopFormValues
} from './workshop-detail'

const WORKSHOP_HOME = '/workshop/'

/** True if the string contains any C0 control char the URL parser would strip. */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x1f) return true
  }
  return false
}

/**
 * Where a visitor may be sent back to after sign-in or a purchase. Only a
 * same-origin absolute path qualifies; anything that could leave the origin
 * (a protocol-relative or backslash prefix, an absolute or javascript: URL,
 * or a path hiding one of those behind a stripped control char) falls back
 * to the Workshop home.
 *
 * The prefix checks alone are not enough: the WHATWG URL parser strips C0
 * control chars (tab, LF, CR) before parsing, so `/<TAB>//evil.com` passes a
 * literal `startsWith('//')` check yet the browser resolves it cross-origin.
 * So a control char is rejected outright, and the result is re-parsed against
 * the current origin to confirm it truly stays same-origin.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (
    typeof raw !== 'string' ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.startsWith('/\\') ||
    hasControlChar(raw)
  ) {
    return WORKSHOP_HOME
  }
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://comfy.org'
  try {
    const resolved = new URL(raw, origin)
    if (resolved.origin !== origin) return WORKSHOP_HOME
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return WORKSHOP_HOME
  }
}

const FORM_KEY_PREFIX = 'comfy.workshop.form.'

/**
 * Media inputs never survive the round trip: their values are '<filename>'
 * placeholder strings a restored form would send as a literal run input.
 * The value's type cannot tell them apart, so the field kind decides.
 */
function restorableKeys(fields: readonly WorkshopField[]): ReadonlySet<string> {
  return new Set(
    fields.filter((field) => field.kind !== 'media').map((field) => field.name)
  )
}

function isRestorableValue(value: unknown): value is WorkshopFormValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
  )
}

/**
 * Persists the form before navigating away to sign in or buy credits, so the
 * visitor lands back with their work intact.
 */
export function stashWorkshopForm(
  slug: string,
  fields: readonly WorkshopField[],
  values: WorkshopFormValues
): void {
  const keep = restorableKeys(fields)
  const kept = Object.fromEntries(
    Object.entries(values).filter(
      ([name, value]) => keep.has(name) && value !== undefined
    )
  )
  try {
    globalThis.sessionStorage?.setItem(
      `${FORM_KEY_PREFIX}${slug}`,
      JSON.stringify(kept)
    )
  } catch {
    // Quota or disabled storage: the round trip loses the form, nothing else.
  }
}

/**
 * One-shot restore: reads, removes, and re-validates the stash. Everything
 * in sessionStorage is editable by the visitor, so each value is checked
 * against the model's own fields again at this consume seam.
 */
export function popWorkshopForm(
  slug: string,
  fields: readonly WorkshopField[]
): WorkshopFormValues | undefined {
  const key = `${FORM_KEY_PREFIX}${slug}`
  let raw: string | null
  try {
    raw = globalThis.sessionStorage?.getItem(key) ?? null
    globalThis.sessionStorage?.removeItem(key)
  } catch {
    return undefined
  }
  if (raw === null) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined
  }

  const keep = restorableKeys(fields)
  const restored = Object.fromEntries(
    Object.entries(parsed).filter(
      ([name, value]) => keep.has(name) && isRestorableValue(value)
    )
  )
  return Object.keys(restored).length > 0 ? restored : undefined
}
