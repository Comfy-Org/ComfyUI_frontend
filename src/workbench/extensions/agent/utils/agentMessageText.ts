import { getMediaTypeFromFilename } from '@comfyorg/shared-frontend-utils/formatUtil'

import type { ConversationEntry } from '../stores/agent/agentConversationStore'
import { workflowReferenceParts } from './workflowReferenceParts'

export function nodeReferenceText(name: string): string {
  return `@[Node: ${name}]`
}

export function assetReferenceText(name: string): string {
  const kind = getMediaTypeFromFilename(name)
  const label = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    '3D': '3D',
    text: 'File',
    other: 'File'
  }[kind]
  return `@[${label}: ${name}]`
}

export function agentMessageText(
  message: Pick<
    Extract<ConversationEntry, { role: 'user' }>,
    'text' | 'workflowReferences' | 'tags' | 'attachments'
  >
): string {
  const text = workflowReferenceParts(
    message.text,
    message.workflowReferences ?? []
  )
    .map((part) =>
      part.type === 'text' ? part.text : `@[Workflow: ${part.reference.name}]`
    )
    .join('')
  const context = [
    ...(message.tags ?? []).map(nodeReferenceText),
    ...(message.attachments ?? []).map(({ name }) => assetReferenceText(name))
  ].filter((label) => !text.includes(label))
  return [text, ...new Set(context)].filter(Boolean).join('\n')
}
