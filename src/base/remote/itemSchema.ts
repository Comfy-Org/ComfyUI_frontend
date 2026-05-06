import type { RemoteItemSchema } from '@/schemas/nodeDefSchema'

export interface DropdownItemShape {
  id: string
  name: string
  description?: string
  preview_url?: string
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

export function mapToDropdownItem(
  raw: unknown,
  schema: RemoteItemSchema
): DropdownItemShape {
  return {
    id: String(getByPath(raw, schema.value_field) ?? ''),
    name: resolveLabel(schema.label_field, raw),
    description: schema.description_field
      ? resolveLabel(schema.description_field, raw)
      : undefined,
    preview_url: schema.preview_url_field
      ? String(getByPath(raw, schema.preview_url_field) ?? '')
      : undefined
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
