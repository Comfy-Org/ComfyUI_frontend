import type { WorkflowJson } from '../types'

const NOTE_TYPES = new Set(['Note', 'MarkdownNote', 'CM_NoteNode'])
const PROMPT_TYPES = new Set(['CLIPTextEncode', 'CLIPTextEncodeSDXL'])
const TEXT_TYPES = new Set(['MultilineText', 'ShowText', 'TextInput'])
const MAX_LENGTH = 3000

export interface ExtractedWorkflowText {
  authorNotes: string
  examplePrompts: string[]
  groupTitles: string[]
  customNodeLabels: { nodeType: string; customTitle: string }[]
}

function extractStringWidgets(node: Record<string, unknown>): string[] {
  const vals: string[] = []
  const widgetsValues = node.widgets_values
  if (Array.isArray(widgetsValues)) {
    for (const val of widgetsValues) {
      if (typeof val === 'string' && val.trim()) {
        vals.push(val.trim())
      }
    }
  } else if (widgetsValues && typeof widgetsValues === 'object') {
    for (const val of Object.values(widgetsValues as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) {
        vals.push(val.trim())
      }
    }
  }
  return vals
}

export function extractAllWorkflowText(
  workflow: WorkflowJson
): ExtractedWorkflowText {
  const noteTexts: string[] = []
  const examplePrompts: string[] = []
  const customNodeLabels: { nodeType: string; customTitle: string }[] = []

  for (const node of workflow.nodes || []) {
    const nodeType = node.type as string
    if (!nodeType) continue

    if (NOTE_TYPES.has(nodeType) || TEXT_TYPES.has(nodeType)) {
      noteTexts.push(...extractStringWidgets(node as Record<string, unknown>))
    } else if (PROMPT_TYPES.has(nodeType)) {
      examplePrompts.push(
        ...extractStringWidgets(node as Record<string, unknown>)
      )
    }

    const title = node.title as string | undefined
    if (title && title !== nodeType) {
      customNodeLabels.push({ nodeType, customTitle: title })
    }
  }

  const groups =
    ((workflow as Record<string, unknown>).groups as { title?: string }[]) || []
  const groupTitles = groups.map((g) => g.title).filter((t): t is string => !!t)

  const combinedNotes = noteTexts.join('\n\n').replace(/<[^>]*>/g, '')

  return {
    authorNotes: combinedNotes.slice(0, MAX_LENGTH),
    examplePrompts,
    groupTitles,
    customNodeLabels
  }
}

export function extractAuthorNotes(workflow: WorkflowJson): string {
  return extractAllWorkflowText(workflow).authorNotes
}
