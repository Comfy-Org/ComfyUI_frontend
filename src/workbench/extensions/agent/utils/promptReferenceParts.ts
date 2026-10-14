import type { SkillReference } from '../types/skillReference'
import type { WorkflowReference } from '../types/workflowReference'

export function promptReferenceParts(
  text: string,
  workflows: WorkflowReference[],
  skill?: SkillReference
) {
  const references: (
    | { type: 'workflow'; reference: WorkflowReference }
    | { type: 'skill'; reference: SkillReference }
  )[] = workflows.map((reference) => ({ type: 'workflow', reference }))
  if (skill)
    references.splice(skill.workflowIndex ?? workflows.length, 0, {
      type: 'skill',
      reference: skill
    })
  references.sort((a, b) => a.reference.textOffset - b.reference.textOffset)
  const parts: (
    | { type: 'text'; text: string }
    | (typeof references)[number]
  )[] = []
  let offset = 0
  for (const item of references) {
    const next = Math.max(
      offset,
      Math.min(text.length, item.reference.textOffset)
    )
    if (next > offset)
      parts.push({ type: 'text', text: text.slice(offset, next) })
    parts.push(item)
    offset = next
  }
  if (offset < text.length)
    parts.push({ type: 'text', text: text.slice(offset) })
  return parts
}
