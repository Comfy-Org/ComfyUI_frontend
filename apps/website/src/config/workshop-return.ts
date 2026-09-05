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
function restoreValue(
  field: WorkshopField,
  value: unknown
): { readonly value: WorkshopFormValue } | undefined {
  if (field.kind === 'media') return undefined
  // JSON cannot encode `undefined`; null is the private storage sentinel for
  // a deliberately cleared optional field.
  if (value === null) return { value: undefined }
  switch (field.kind) {
    case 'text':
      return typeof value === 'string' ? { value } : undefined
    case 'select':
      return field.options.some((option) => Object.is(option, value))
        ? { value: value as string | number | boolean }
        : undefined
    case 'number':
      return typeof value === 'number' &&
        Number.isFinite(value) &&
        (!field.integer || Number.isInteger(value)) &&
        (field.min === undefined || value >= field.min) &&
        (field.max === undefined || value <= field.max)
        ? { value }
        : undefined
    case 'toggle':
      return typeof value === 'boolean' ? { value } : undefined
  }
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
  const keep = new Set(
    fields.filter((field) => field.kind !== 'media').map((field) => field.name)
  )
  const kept = Object.fromEntries(
    Object.entries(values)
      .filter(([name]) => keep.has(name))
      .map(([name, value]) => [name, value === undefined ? null : value])
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

  const byName = new Map(fields.map((field) => [field.name, field]))
  const restored: Record<string, WorkshopFormValue> = {}
  for (const [name, value] of Object.entries(parsed)) {
    const field = byName.get(name)
    if (!field) continue
    const valid = restoreValue(field, value)
    if (valid) restored[name] = valid.value
  }
  return Object.keys(restored).length > 0 ? restored : undefined
}

/**
 * Resolve an explicit return destination. A plain visit to the sign-in page
 * has no destination and must remain there after sign-in.
 */
export function requestedReturnPath(search: string): string | undefined {
  const raw = new URLSearchParams(search).get('returnTo')
  return raw ? safeReturnPath(raw) : undefined
}
