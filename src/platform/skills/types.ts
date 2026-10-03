import type {
  AgentSkill,
  AgentSkillPublishRequest
} from '@comfyorg/ingest-types'

/**
 * One of the caller's own skill packs, as returned by `GET /api/agent/skills`.
 * The list response carries the full `body` on every row, so opening a pack for
 * editing needs no second fetch — there is no fetch-one endpoint.
 */
export type SkillPack = AgentSkill

/** The create-or-replace payload for `POST /api/agent/skills`. */
export type SkillPackPublishRequest = AgentSkillPublishRequest

/** `maxLength` from the spec, counted in code points as JSON Schema defines it. */
export const MAX_DESCRIPTION_CODE_POINTS = 1024
export const MAX_NAME_LENGTH = 64

/**
 * Pack names: letters, digits, `.`, `_` and `-`, with at least one character
 * that is not a dot. The all-dot exclusion is deliberate — `.` and `..` are
 * path segments a normalizing client rewrites, so such a pack could be created
 * but never deleted.
 */
export const PACK_NAME_PATTERN = /^[A-Za-z0-9._-]*[A-Za-z0-9_-][A-Za-z0-9._-]*$/

/**
 * Built-in always-on packs, whose names the server refuses. The built-in
 * on-demand packs (`batch-generation`, `comfy-director`) are deliberately
 * shadowable, so they are not listed here.
 */
export const RESERVED_PACK_NAMES = [
  'building',
  'comfy-cloud',
  'canvas-tabs'
] as const

/**
 * Control characters, CR and LF included, are refused in the description: it is
 * a single-line trigger description that rides in every prompt.
 */
// eslint-disable-next-line no-control-regex
export const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/

/** UTF-8 byte length, used to show the payload size before publishing. */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

/** Code-point count, which is how the spec counts `description`. */
export function codePointLength(value: string): number {
  // Code points are exactly the unit the spec counts in, so the decomposition
  // this rule warns about is the intended behaviour here.
  // oxlint-disable-next-line no-misused-spread
  return [...value].length
}

/** Description + body, the unit the per-user total-bytes budget is counted in. */
export function packByteSize(pack: {
  description: string
  body: string
}): number {
  return utf8ByteLength(pack.description) + utf8ByteLength(pack.body)
}
