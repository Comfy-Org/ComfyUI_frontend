import {
  zAgentProbeableAttachmentExtension,
  zAgentReadableAttachmentExtension,
  zAgentReferenceAttachmentExtension,
  zAgentRetainedAttachmentExtension,
  zAgentViewableAttachmentExtension
} from '@comfyorg/ingest-types/zod'

import type { VideoExtension } from '@/utils/formatUtil'

/** What the agent can do with an attachment, per the server's extension tiers. */
export type AgentAttachCapability =
  | 'view'
  | 'probe'
  | 'read'
  | 'reference'
  | 'retain'

const CAPABILITY_BY_EXTENSION = new Map<string, AgentAttachCapability>([
  ...zAgentViewableAttachmentExtension.options.map(
    (extension) => [extension, 'view'] as const
  ),
  ...zAgentProbeableAttachmentExtension.options.map(
    (extension) => [extension, 'probe'] as const
  ),
  ...zAgentReferenceAttachmentExtension.options.map(
    (extension) => [extension, 'reference'] as const
  ),
  ...zAgentReadableAttachmentExtension.options.map(
    (extension) => [extension, 'read'] as const
  ),
  ...zAgentRetainedAttachmentExtension.options.map(
    (extension) => [extension, 'retain'] as const
  )
])

/** The file input's `accept` value: every accepted extension, no wildcards. */
export const AGENT_ATTACH_ACCEPT = [...CAPABILITY_BY_EXTENSION.keys()].join(',')

const EXTENSION_PATTERN = /\.[a-z0-9]{1,8}$/i
const AUTHORITATIVE_EXTENSION_PATTERN = /\.[^./\\]+$/

function extensionOf(filename: string): string {
  const match = EXTENSION_PATTERN.exec(filename)?.[0].toLowerCase()
  return match && /[a-z]/.test(match) ? match : ''
}

/** The tier for a file name, or undefined when the agent does not accept it. */
export function agentAttachCapability(
  filename: string
): AgentAttachCapability | undefined {
  return CAPABILITY_BY_EXTENSION.get(extensionOf(filename))
}

export function isAgentAttachable(file: File): boolean {
  return agentAttachCapability(file.name) !== undefined
}

/** `unknown` means the name has no extension to judge. */
export type AgentAttachVerdict = 'accepted' | 'rejected' | 'unknown'

/** Judges a display label; digit-only suffixes such as `v1.2` are not extensions. */
export function agentAttachVerdict(filename: string): AgentAttachVerdict {
  if (agentAttachCapability(filename)) return 'accepted'
  return extensionOf(filename) === '' ? 'unknown' : 'rejected'
}

/** Judges a stored filename or URL, where any final dotted token is an extension. */
export function agentAttachRefVerdict(ref: string): AgentAttachVerdict {
  if (agentAttachCapability(ref)) return 'accepted'
  return AUTHORITATIVE_EXTENSION_PATTERN.test(ref) ? 'rejected' : 'unknown'
}

function bytesMatch(bytes: Uint8Array, offset: number, expected: string) {
  return expected
    .split('')
    .every((char, index) => bytes[offset + index] === char.charCodeAt(0))
}

type VideoContainerCheck = (bytes: Uint8Array) => boolean

const ISO_BASE_MEDIA_BOXES = [
  'ftyp',
  'moov',
  'mdat',
  'wide',
  'free',
  'skip',
  'pnot'
] as const
const EBML_MAGIC = '\x1a\x45\xdf\xa3'

function isIsoBaseMedia(bytes: Uint8Array) {
  return ISO_BASE_MEDIA_BOXES.some((box) => bytesMatch(bytes, 4, box))
}

function isEbml(bytes: Uint8Array) {
  return bytesMatch(bytes, 0, EBML_MAGIC)
}

const VIDEO_CONTAINER_CHECKS: Partial<Record<string, VideoContainerCheck>> = {
  mp4: isIsoBaseMedia,
  m4v: isIsoBaseMedia,
  mov: isIsoBaseMedia,
  webm: isEbml,
  mkv: isEbml,
  avi: (bytes) => bytesMatch(bytes, 0, 'RIFF') && bytesMatch(bytes, 8, 'AVI ')
} satisfies Record<VideoExtension, VideoContainerCheck>

export function isValidAgentAttachment(file: File): boolean | Promise<boolean> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const check = Object.hasOwn(VIDEO_CONTAINER_CHECKS, extension)
    ? VIDEO_CONTAINER_CHECKS[extension]
    : undefined
  if (!check) return true

  return file
    .slice(0, 12)
    .arrayBuffer()
    .then((buffer) => check(new Uint8Array(buffer)))
    .catch(() => false)
}
