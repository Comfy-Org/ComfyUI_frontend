import type { MediaType } from '@comfyorg/shared-frontend-utils/formatUtil'
import { getMediaTypeFromFilename } from '@comfyorg/shared-frontend-utils/formatUtil'

import type { ConversationEntry } from '../stores/agent/agentConversationStore'
import type { SkillReference } from '../types/skillReference'
import { promptReferenceParts } from './promptReferenceParts'

export function nodeReferenceText(name: string): string {
  return `@[Node: ${name}]`
}

export function assetReferenceText(
  name: string,
  resolvedKind?: MediaType
): string {
  const kind = resolvedKind ?? getMediaTypeFromFilename(name)
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
  > & { skillReference?: SkillReference }
): string {
  const text = promptReferenceParts(
    message.text,
    message.workflowReferences ?? [],
    message.skillReference
  )
    .map((part) =>
      part.type === 'text'
        ? part.text
        : part.type === 'skill'
          ? `/${part.reference.name}`
          : `@[Workflow: ${part.reference.name}]`
    )
    .join('')
  const context = [
    ...(message.tags ?? []).map(nodeReferenceText),
    ...(message.attachments ?? []).map(({ name, kind }) =>
      assetReferenceText(name, kind)
    )
  ].filter((label) => !text.includes(label))
  return [text, ...new Set(context)].filter(Boolean).join('\n')
}
