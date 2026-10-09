import type {
  AgentSkill,
  AgentSkillPublishRequest
} from '@comfyorg/ingest-types'

/** The list route returns the user's packs with their full instruction bodies. */
export type SkillPack = AgentSkill

export type SkillPackPublishRequest = AgentSkillPublishRequest

/** `maxLength` from the spec, counted in code points as JSON Schema defines it. */
export const MAX_DESCRIPTION_CODE_POINTS = 1024
export const MAX_NAME_LENGTH = 64

/** All-dot names are excluded because clients normalize `.` and `..` paths. */
export const PACK_NAME_PATTERN = /^[A-Za-z0-9._-]*[A-Za-z0-9_-][A-Za-z0-9._-]*$/

/** Only always-on built-ins are reserved; on-demand built-ins are shadowable. */
export const RESERVED_PACK_NAMES = [
  'building',
  'comfy-cloud',
  'canvas-tabs'
] as const

export const CONTROL_CHARACTERS = /[\p{Cc}\u2028\u2029]/u

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

export function codePointLength(value: string): number {
  return Array.from(value).length
}

/** Description + body, the unit the per-user total-bytes budget is counted in. */
export function packByteSize(pack: {
  description: string
  body: string
}): number {
  return utf8ByteLength(pack.description) + utf8ByteLength(pack.body)
}
