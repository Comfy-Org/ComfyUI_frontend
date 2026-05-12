import type { AssetUserMetadata } from '@/platform/assets/schemas/assetSchema'

export const USER_METADATA_CUSTOM_KEY = 'custom'

export type UserMetadataPrimitiveType = 'string' | 'number' | 'boolean'

type CustomMetadataBucketState = 'missing' | 'valid' | 'invalid'

type ParsedCustomPrimitiveRow = {
  kind: 'customPrimitive'
  key: string
  primitiveType: UserMetadataPrimitiveType
  value: string | number | boolean
}

type ParsedUnsupportedInCustomRow = {
  kind: 'unsupportedInCustom'
  key: string
  preview: string
}

export type CustomMetadataKeyIssue =
  | 'empty'
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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
  unsupportedInCustom: ParsedUnsupportedInCustomRow[]
  customBucketState: CustomMetadataBucketState
  invalidCustomPreview?: string
} {
  const empty = {
    customPrimitives: [] as ParsedCustomPrimitiveRow[],
    unsupportedInCustom: [] as ParsedUnsupportedInCustomRow[],
    customBucketState: 'missing' as const
  }

  if (!metadata) {
    return empty
  }

  const raw = metadata[USER_METADATA_CUSTOM_KEY]
  if (raw === undefined) {
    return empty
  }
  if (raw === null || !isPlainObject(raw)) {
    return {
      customPrimitives: [],
      unsupportedInCustom: [],
      customBucketState: 'invalid',
      invalidCustomPreview: truncateJsonPreview(raw)
    }
  }

  const customPrimitives: ParsedCustomPrimitiveRow[] = []
  const unsupportedInCustom: ParsedUnsupportedInCustomRow[] = []
  const keys = Object.keys(raw).sort((a, b) => a.localeCompare(b))
  for (const key of keys) {
    const value = raw[key]
    const primitiveType = classifyPrimitive(value)
    if (primitiveType !== null) {
      customPrimitives.push({
        kind: 'customPrimitive',
        key,
        primitiveType,
        value: value as string | number | boolean
      })
    } else {
      unsupportedInCustom.push({
        kind: 'unsupportedInCustom',
        key,
        preview: truncateJsonPreview(value)
      })
    }
  }

  return {
    customPrimitives,
    unsupportedInCustom,
    customBucketState: 'valid'
  }
}

/**
 * Merges model-info pending fields and `user_metadata.custom` patches/deletes
 * into a full `user_metadata` object for PUT. Other top-level keys are only
 * changed via `modelPanelUpdates`. Custom mutations run only when
 * `customPatches` or `customDeleteKeys` is non-empty.
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

  const hasCustomMutation =
    Object.keys(customPatches).length > 0 || customDeleteKeys.size > 0
  if (!hasCustomMutation) {
    return next
  }

  const raw = next[USER_METADATA_CUSTOM_KEY]
  const base: Record<string, unknown> = isPlainObject(raw) ? { ...raw } : {}
  for (const k of customDeleteKeys) {
    delete base[k]
  }
  for (const [k, v] of Object.entries(customPatches)) {
    base[k] = v
  }

  next[USER_METADATA_CUSTOM_KEY] = base
  return next
}
