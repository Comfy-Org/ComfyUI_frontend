import { safeInternalPath } from '@comfyorg/account/redirect'

import type {
  WorkshopField,
  WorkshopFormValue,
  WorkshopFormValues
} from './workshop-detail'

const WORKSHOP_HOME = '/workshop/'

/**
 * Where a visitor may be sent back to after sign-in or a purchase: a
 * same-origin absolute path, else the Workshop home.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://comfy.org'
  return safeInternalPath(raw, origin, WORKSHOP_HOME)
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
    globalThis.sessionStorage.setItem(
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
    raw = globalThis.sessionStorage.getItem(key) ?? null
    globalThis.sessionStorage.removeItem(key)
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
