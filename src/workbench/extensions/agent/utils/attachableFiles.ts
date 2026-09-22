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
  'txt',
  'csv'
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
