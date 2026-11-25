import type {
  WorkflowReference,
  WorkflowReferenceMetadata
} from '@/workbench/extensions/agent/types/workflowReference'
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

export interface HydratedUserTurn {
  turnId: string
  text: string
  skillName?: string
  attachmentCount?: number
}

export interface ExpectedPendingUserTurn {
  text: string
  skillName?: string
  workflowReferences: readonly WorkflowReference[]
  attachmentCount?: number
}

function normalizePersistedTurnText(
  text: string,
  workflowReferences: readonly WorkflowReference[]
): string {
  if (workflowReferences.length === 0) return text
  return parseWorkflowReferences(
    text,
    workflowReferences.map(({ id, name, unavailable }) => ({
      id,
      name,
      unavailable
    }))
  ).text
}

export function matchesHydratedUserTurn(
  expected: ExpectedPendingUserTurn,
  turn: HydratedUserTurn
): boolean {
  const persistedText = normalizePersistedTurnText(
    turn.text,
    expected.workflowReferences
  )
  if (persistedText !== expected.text) return false
  if (turn.skillName !== expected.skillName) return false
  if (expected.text || expected.skillName) return true
  const expectedCount = expected.attachmentCount ?? 0
  return expectedCount > 0 && (turn.attachmentCount ?? 0) === expectedCount
}
