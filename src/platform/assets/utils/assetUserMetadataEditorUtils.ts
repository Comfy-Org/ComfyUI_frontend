import type { AssetUserMetadata } from '@/platform/assets/schemas/assetSchema'

import { isReservedUserMetadataKey } from './assetUserMetadataReservedKeys'

export type UserMetadataPrimitiveType = 'string' | 'number' | 'boolean'

export type ParsedCustomPrimitiveRow = {
  kind: 'customPrimitive'
  key: string
  primitiveType: UserMetadataPrimitiveType
  value: string | number | boolean
}

export type ParsedSystemReadOnlyRow = {
  kind: 'systemReadOnly'
  key: string
  primitiveType: UserMetadataPrimitiveType
  value: string | number | boolean
}

export type ParsedUnsupportedRow = {
  kind: 'unsupported'
  key: string
  preview: string
}

export type CustomMetadataKeyIssue =
  | 'empty'
  | 'reserved'
  | 'invalid_format'
  | 'max_length'
  | 'duplicate'

const CUSTOM_KEY_MAX_LENGTH = 64
const CUSTOM_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export const DEFAULT_USER_METADATA_JSON_PREVIEW_MAX = 280

function classifyPrimitive(value: unknown): UserMetadataPrimitiveType | null {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return 'number'
  }
  return null
}

export function truncateJsonPreview(
  value: unknown,
  maxLen = DEFAULT_USER_METADATA_JSON_PREVIEW_MAX
): string {
  try {
    const text = JSON.stringify(value)
    if (text.length <= maxLen) return text
    return `${text.slice(0, Math.max(0, maxLen - 1))}…`
  } catch {
    return '[Unserializable]'
  }
}

export function validateCustomMetadataKey(key: string):
  | {
      ok: true
    }
  | { ok: false; issue: CustomMetadataKeyIssue } {
  const trimmed = key.trim()
  if (!trimmed) return { ok: false, issue: 'empty' }
  if (isReservedUserMetadataKey(trimmed))
    return { ok: false, issue: 'reserved' }
  if (trimmed.length > CUSTOM_KEY_MAX_LENGTH)
    return { ok: false, issue: 'max_length' }
  if (!CUSTOM_KEY_PATTERN.test(trimmed))
    return { ok: false, issue: 'invalid_format' }
  return { ok: true }
}

export function parseUserMetadataForEditor(
  metadata: Record<string, unknown> | undefined
): {
  customPrimitives: ParsedCustomPrimitiveRow[]
  systemPrimitives: ParsedSystemReadOnlyRow[]
  unsupported: ParsedUnsupportedRow[]
} {
  const customPrimitives: ParsedCustomPrimitiveRow[] = []
  const systemPrimitives: ParsedSystemReadOnlyRow[] = []
  const unsupported: ParsedUnsupportedRow[] = []

  if (!metadata) {
    return { customPrimitives, systemPrimitives, unsupported }
  }

  const keys = Object.keys(metadata).sort((a, b) => a.localeCompare(b))
  for (const key of keys) {
    const raw = metadata[key]
    const primitiveType = classifyPrimitive(raw)
    if (primitiveType !== null) {
      const value = raw as string | number | boolean
      if (isReservedUserMetadataKey(key)) {
        systemPrimitives.push({
          kind: 'systemReadOnly',
          key,
          primitiveType,
          value
        })
      } else {
        customPrimitives.push({
          kind: 'customPrimitive',
          key,
          primitiveType,
          value
        })
      }
      continue
    }

    unsupported.push({
      kind: 'unsupported',
      key,
      preview: truncateJsonPreview(raw)
    })
  }

  return { customPrimitives, systemPrimitives, unsupported }
}

/**
 * Merges model-info pending fields, custom primitive patches, and custom key
 * deletions into a full `user_metadata` object for PUT.
 */
export function mergeUserMetadataForAssetPut(
  assetUserMetadata: Record<string, unknown> | undefined,
  modelPanelUpdates: AssetUserMetadata,
  customPatches: Record<string, string | number | boolean>,
  customDeleteKeys: ReadonlySet<string>
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...(assetUserMetadata ?? {}),
    ...modelPanelUpdates
  }
  for (const k of customDeleteKeys) {
    if (!isReservedUserMetadataKey(k)) {
      delete next[k]
    }
  }
  for (const [k, v] of Object.entries(customPatches)) {
    if (!isReservedUserMetadataKey(k)) {
      next[k] = v
    }
  }
  return next
}
