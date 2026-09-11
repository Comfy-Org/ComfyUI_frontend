import type {
  WorkflowReference,
  WorkflowReferenceMetadata
} from '../types/workflowReference'
import { workflowReferenceParts } from './workflowReferenceParts'

function workflowReferenceUrl(id: string): string {
  return `workflow://${encodeURIComponent(id).replaceAll('(', '%28').replaceAll(')', '%29')}`
}

export function serializeWorkflowReferences(
  text: string,
  references: WorkflowReference[]
): string {
  return workflowReferenceParts(text, references)
    .map((part) => {
      if (part.type === 'text') return part.text
      const name = part.reference.name.replace(/[\\[\]]/g, '\\$&')
      return `[${name}](${workflowReferenceUrl(part.reference.id)})`
    })
    .join('')
}

export function parseWorkflowReferences(
  content: string,
  references: WorkflowReferenceMetadata[]
): { text: string; references: WorkflowReference[] } {
  const remaining = new Map(
    references.map((reference) => [
      workflowReferenceUrl(reference.id),
      { ...reference, textOffset: 0 }
    ])
  )
  const positioned: WorkflowReference[] = []
  let text = ''
  let offset = 0
  for (const match of content.matchAll(
    /\[((?:\\.|[^\]\\])*)\]\((workflow:\/\/[^\s)]+)\)/g
  )) {
    const reference = remaining.get(match[2])
    if (!reference) continue
    text += content.slice(offset, match.index)
    positioned.push({
      ...reference,
      name: match[1].replace(/\\([\\[\]])/g, '$1'),
      textOffset: text.length
    })
    remaining.delete(match[2])
    offset = match.index + match[0].length
  }
  return {
    text: text + content.slice(offset),
    references: [...remaining.values(), ...positioned]
  }
}
