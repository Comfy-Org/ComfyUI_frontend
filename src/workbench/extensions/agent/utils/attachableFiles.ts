import type { MediaType } from '@/utils/formatUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const AGENT_ATTACH_MEDIA_KINDS = [
  'image',
  'video',
  'audio'
] as const satisfies readonly MediaType[]
const MEDIA_ATTACHABLE_KINDS = new Set<MediaType>(AGENT_ATTACH_MEDIA_KINDS)

/* Non-media formats approved for agent attach (Jo, FE-1323); extended as the
   backend grows support. json is deliberately left out here: the panel's
   drop handler claims a raw File drop only when isAgentAttachable approves
   it, and a bare-dropped workflow .json must stay unclaimed so the graph
   loader (which only runs on an unclaimed drop) can still open it. */
const AGENT_ATTACH_EXTENSIONS = [
  'mp4',
  'm4a',
  'mov',
  'mp3',
  'wav',
  'glb',
  'md',
  'txt'
] as const
const ATTACHABLE_EXTENSIONS = new Set<string>(AGENT_ATTACH_EXTENSIONS)

/* The OS picker cannot express "any audio plus these extensions" through MIME
   alone (glb and md have no reliable browser MIME), so the accept list names
   the extensions explicitly alongside the media wildcards. */
export const AGENT_ATTACH_ACCEPT = [
  ...AGENT_ATTACH_MEDIA_KINDS.map((kind) => `${kind}/*`),
  ...AGENT_ATTACH_EXTENSIONS.map((extension) => `.${extension}`),
  '.json',
  'application/json'
].join(',')

/**
 * Judged by file NAME, not MIME type: dragged glb/md/txt files carry an empty
 * or generic MIME, and the reply pipeline classifies by extension already.
 *
 * .json is intentionally excluded even though it is in AGENT_ATTACH_ACCEPT:
 * this only gates the OS file-picker's visible filter, letting a user select
 * a .json through the picker. A raw drag-and-drop of a .json file must still
 * fall through to the graph loader, which treats it as a workflow to open.
 */
export function isAgentAttachable(file: File): boolean {
  if (MEDIA_ATTACHABLE_KINDS.has(getMediaTypeFromFilename(file.name)))
    return true
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ATTACHABLE_EXTENSIONS.has(extension)
}

const bytesMatch = (bytes: Uint8Array, offset: number, expected: number[]) =>
  expected.every((value, index) => bytes[offset + index] === value)

/**
 * Confirms that a video starts with the container signature implied by its
 * filename. Browsers infer File.type from a renamed extension, so MIME alone
 * cannot distinguish a text file renamed to `.mp4`.
 */
export async function isValidAgentAttachment(file: File): Promise<boolean> {
  if (getMediaTypeFromFilename(file.name) !== 'video') return true

  const extension = file.name.split('.').pop()?.toLowerCase()
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())

  switch (extension) {
    case 'mp4':
    case 'm4v':
    case 'mov':
      return bytesMatch(bytes, 4, [0x66, 0x74, 0x79, 0x70]) // ftyp
    case 'webm':
    case 'mkv':
      return bytesMatch(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3]) // EBML
    case 'avi':
      return (
        bytesMatch(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && // RIFF
        bytesMatch(bytes, 8, [0x41, 0x56, 0x49, 0x20]) // AVI
      )
    default:
      return false
  }
}
