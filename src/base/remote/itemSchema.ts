import type { RemoteItemSchema } from '@/schemas/nodeDefSchema'

export interface DropdownItemShape {
  id: string
  name: string
  description?: string
  preview_url?: string
}

/**
 * User-facing label for a dropdown item. Falls back to id when name
 * is missing or empty, so trigger/list rows never render blank.
 */
export function displayName(item: DropdownItemShape): string {
  return item.name || item.id
}

export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc == null) return undefined
    const idx = Number(key)
    if (Number.isInteger(idx) && idx >= 0 && Array.isArray(acc)) return acc[idx]
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

export function resolveLabel(template: string, item: unknown): string {
  if (!template.includes('{')) {
    return String(getByPath(item, template) ?? '')
  }
  return template.replace(/\{([^}]+)\}/g, (_, path: string) =>
    String(getByPath(item, path) ?? '')
  )
}

const ABSOLUTE_URL_REGEX = /^([a-z][a-z0-9+.-]*:)?\/\//i
const DATA_URL_PREFIX = 'data:'
const BLOB_URL_PREFIX = 'blob:'

function resolvePreviewUrl(
  raw: string | undefined,
  baseUrl?: string
): string | undefined {
  if (!raw) return undefined
  const lowered = raw.toLowerCase()
  if (
    ABSOLUTE_URL_REGEX.test(raw) ||
    lowered.startsWith(DATA_URL_PREFIX) ||
    lowered.startsWith(BLOB_URL_PREFIX)
  ) {
    return raw
  }
  if (!baseUrl) return raw
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`
  return normalizedBase + normalizedPath
}

export function mapToDropdownItem(
  raw: unknown,
  schema: RemoteItemSchema,
  options: { previewBaseUrl?: string } = {}
): DropdownItemShape {
  const previewRaw = schema.preview_url_field
    ? String(getByPath(raw, schema.preview_url_field) ?? '')
    : undefined
  return {
    id: String(getByPath(raw, schema.value_field) ?? ''),
    name: resolveLabel(schema.label_field, raw),
    description: schema.description_field
      ? resolveLabel(schema.description_field, raw)
      : undefined,
    preview_url: resolvePreviewUrl(previewRaw, options.previewBaseUrl)
  }
}

export function extractItems(
  response: unknown,
  responseKey?: string
): unknown[] | null {
  const data = responseKey ? getByPath(response, responseKey) : response
  return Array.isArray(data) ? data : null
}

export function buildSearchText(raw: unknown, searchFields: string[]): string {
  return searchFields
    .map((field) => String(getByPath(raw, field) ?? ''))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
