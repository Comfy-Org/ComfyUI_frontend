import type { WorkflowReference } from '../types/workflowReference'
import { promptReferenceParts } from './promptReferenceParts'

export function workflowReferenceParts(
  text: string,
  references: WorkflowReference[]
) {
  return promptReferenceParts(text, references).filter(
    (part) => part.type !== 'skill'
  )
}
