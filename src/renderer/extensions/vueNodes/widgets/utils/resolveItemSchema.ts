import type { RemoteItemSchema } from '@/schemas/nodeDefSchema'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'

/** Traverse an object by dot-path, treating numeric segments as array indices */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc == null) return undefined
    const idx = Number(key)
    if (Number.isInteger(idx) && idx >= 0 && Array.isArray(acc)) return acc[idx]
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

/** Resolve a label — either dot-path or template with {field.path} placeholders */
export function resolveLabel(template: string, item: unknown): string {
  if (!template.includes('{')) {
    return String(getByPath(item, template) ?? '')
  }
  return template.replace(/\{([^}]+)\}/g, (_, path: string) =>
    String(getByPath(item, path) ?? '')
  )
}

/** Map a raw API object to a FormDropdownItem using the item_schema */
export function mapToDropdownItem(
  raw: unknown,
  schema: RemoteItemSchema
): FormDropdownItem {
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

/** Extract items array from full API response using response_key */
export function extractItems(
  response: unknown,
  responseKey?: string
): unknown[] {
  const data = responseKey ? getByPath(response, responseKey) : response
  return Array.isArray(data) ? data : []
}

/** Build search text for an item from the specified search fields */
export function buildSearchText(raw: unknown, searchFields: string[]): string {
  return searchFields
    .map((field) => String(getByPath(raw, field) ?? ''))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Extract unique filter values from items */
export function extractFilterValues(
  items: unknown[],
  filterField: string
): string[] {
  const values = new Set<string>()
  for (const item of items) {
    const value = getByPath(item, filterField)
    if (value != null) values.add(String(value))
  }
  return Array.from(values).sort()
}
