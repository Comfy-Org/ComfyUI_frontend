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

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot).toLowerCase()
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
