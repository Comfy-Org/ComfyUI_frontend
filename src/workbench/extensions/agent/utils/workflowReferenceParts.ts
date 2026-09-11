import type { WorkflowReference } from '../types/workflowReference'

export function workflowReferenceParts(
  text: string,
  references: WorkflowReference[]
) {
  const parts: (
    | { type: 'text'; text: string }
    | { type: 'workflow'; reference: WorkflowReference }
  )[] = []
  let offset = 0
  for (const reference of [...references].sort(
    (a, b) => (a.textOffset ?? 0) - (b.textOffset ?? 0)
  )) {
    const next = Math.max(
      offset,
      Math.min(text.length, reference.textOffset ?? 0)
    )
    if (next > offset)
      parts.push({ type: 'text', text: text.slice(offset, next) })
    parts.push({ type: 'workflow', reference })
    offset = next
  }
  if (offset < text.length)
    parts.push({ type: 'text', text: text.slice(offset) })
  return parts
}
