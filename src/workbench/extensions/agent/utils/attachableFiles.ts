import {
  zAgentProbeableAttachmentExtension,
  zAgentReferenceAttachmentExtension,
  zAgentRetainedAttachmentExtension,
  zAgentViewableAttachmentExtension
} from '@comfyorg/ingest-types/zod'

/**
 * What the agent can do with an attachment, straight off the server contract.
 *
 * The tiers are not interchangeable and the composer must not present them as
 * one list: `view` means the model sees the content, `probe` means it reads
 * metadata and never the content, `reference` means it knows the file exists
 * and can wire it into a graph node, and `retain` means it knows the file
 * exists and nothing more — no node in the catalog loads a text file.
 */
export type AgentAttachCapability = 'view' | 'probe' | 'reference' | 'retain'

/**
 * Derived from the generated enums rather than hand-listed here, so the accept
 * list cannot drift from what the server enforces (it answers 422 for anything
 * outside them). `.options` is what makes this possible: a bare TypeScript
 * union has no runtime form to build an accept string or a lookup from.
 */
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
  ...zAgentRetainedAttachmentExtension.options.map(
    (extension) => [extension, 'retain'] as const
  )
])

/**
 * Extensions only, deliberately. The old value carried `image/*`, `video/*` and
 * `audio/*` wildcards, and the OS picker honours those literally — which is how
 * .hdr, .exr, .wmv, .flv, .aac and .wma reached a paperclip that then did no
 * checking of its own (PM-1854).
 */
export const AGENT_ATTACH_ACCEPT = [...CAPABILITY_BY_EXTENSION.keys()].join(',')

const EXTENSION_PATTERN = /\.[a-z0-9]{1,8}$/i
const AUTHORITATIVE_EXTENSION_PATTERN = /\.[^.]+$/

/**
 * A bare `lastIndexOf('.')` reads `.2` out of a label like "render v1.2" and
 * `.0` out of "Empty Ace Step 1.0". The verdict below would then call those
 * REJECTED types rather than unknown ones, and a gate that refuses on a
 * rejected verdict would veto a perfectly valid file over its version number.
 * Every extension on the accept list contains a letter; a digits-only suffix
 * is a version marker.
 */
function extensionOf(filename: string): string {
  const match = EXTENSION_PATTERN.exec(filename)?.[0].toLowerCase()
  return match && /[a-z]/.test(match) ? match : ''
}

/**
 * Judged by file NAME, not MIME type: dragged 3D and text files carry an empty
 * or generic MIME, and the server keys its own allowlist off the extension for
 * the same reason — the upload route stores no content type for what it takes.
 *
 * Takes a name rather than a File so a staged attachment, which is only ever a
 * name by the time it reaches the chip, can be labelled with the same answer
 * the gate gave it.
 */
export function agentAttachCapability(
  filename: string
): AgentAttachCapability | undefined {
  return CAPABILITY_BY_EXTENSION.get(extensionOf(filename))
}

export function isAgentAttachable(file: File): boolean {
  return agentAttachCapability(file.name) !== undefined
}

/**
 * Three-valued because `undefined` from agentAttachCapability conflates two
 * different answers: "this type is refused" and "there is no extension to
 * judge". Callers must choose the authoritative identity before applying this
 * verdict; a mutable display label must not override a stored filename or
 * opaque server reference.
 */
export type AgentAttachVerdict = 'accepted' | 'rejected' | 'unknown'

export function agentAttachVerdict(filename: string): AgentAttachVerdict {
  if (agentAttachCapability(filename)) return 'accepted'
  return extensionOf(filename) === '' ? 'unknown' : 'rejected'
}

/**
 * Stored filenames and URLs are authoritative file identities, so any final
 * dotted token is an extension to judge. Display labels use the narrower
 * heuristic above because names such as "render.v2" are not file identities.
 */
export function agentAttachRefVerdict(ref: string): AgentAttachVerdict {
  if (agentAttachCapability(ref)) return 'accepted'
  return AUTHORITATIVE_EXTENSION_PATTERN.test(ref) ? 'rejected' : 'unknown'
}

/**
 * Splits a batch into what can be attached and what cannot, so a caller can
 * attach the one and report the other in a single pass. Every upload path funnels
 * through this, which is what keeps the paperclip, a drop and a paste agreeing.
 */
export function partitionAttachableFiles(files: Iterable<File>): {
  attachable: File[]
  rejected: File[]
} {
  const attachable: File[] = []
  const rejected: File[] = []
  for (const file of files) {
    if (isAgentAttachable(file)) attachable.push(file)
    else rejected.push(file)
  }
  return { attachable, rejected }
}
