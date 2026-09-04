import type { MediaType } from '@/utils/formatUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const MEDIA_ATTACHABLE_KINDS = new Set<MediaType>(['image', 'video', 'audio'])

/* Non-media formats approved for agent attachments; extended as the
   backend grows support. */
const EXTRA_ATTACHABLE_EXTENSIONS = new Set(['glb', 'md', 'txt'])

/* The OS picker cannot express "any audio plus these extensions" through MIME
   alone (glb and md have no reliable browser MIME), so the accept list names
   the extensions explicitly alongside the media wildcards. */
export const AGENT_ATTACH_ACCEPT =
  'image/*,video/*,audio/*,.mp4,.m4a,.mov,.mp3,.wav,.glb,.md,.txt'

/**
 * Judged by file NAME, not MIME type: dragged glb/md/txt files carry an empty
 * or generic MIME, and the reply pipeline classifies by extension already.
 */
export function isAgentAttachable(file: File): boolean {
  if (MEDIA_ATTACHABLE_KINDS.has(getMediaTypeFromFilename(file.name)))
    return true
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTRA_ATTACHABLE_EXTENSIONS.has(extension)
}
