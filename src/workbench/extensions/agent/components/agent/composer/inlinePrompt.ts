import { Schema } from '@tiptap/pm/model'
import type { Node } from '@tiptap/pm/model'

import type { WorkflowReference } from '../../../types/workflowReference'
import { workflowReferenceParts } from '../../../utils/workflowReferenceParts'

export const inlinePromptSchema = new Schema({
  nodes: {
    doc: { content: 'inline*', whitespace: 'pre' },
    text: { group: 'inline' },
    workflow: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: { id: {}, name: {}, unavailable: { default: false } },
      toDOM: (node) => [
        'span',
        {
          'data-comfy-workflow': '1',
          'data-workflow-id': node.attrs.id,
          'data-workflow-unavailable': String(node.attrs.unavailable)
        },
        node.attrs.name
      ],
      parseDOM: [
        {
          tag: 'span[data-comfy-workflow="1"]',
          getAttrs(element) {
            const id = element.getAttribute('data-workflow-id')?.trim()
            const name = element.textContent
            return id && name.trim()
              ? {
                  id,
                  name,
                  unavailable:
                    element.getAttribute('data-workflow-unavailable') === 'true'
                }
              : false
          }
        }
      ]
    }
  }
})

export function promptDocument(
  text: string,
  references: WorkflowReference[]
): Node {
  const content = workflowReferenceParts(text, references).map((part) =>
    part.type === 'text'
      ? inlinePromptSchema.text(part.text)
      : inlinePromptSchema.nodes.workflow.create({
          id: part.reference.id,
          name: part.reference.name,
          unavailable: part.reference.unavailable === true
        })
  )
  return inlinePromptSchema.nodes.doc.create(null, content)
}

export function promptDraft(doc: Node): {
  text: string
  references: WorkflowReference[]
} {
  let text = ''
  const references: WorkflowReference[] = []
  doc.forEach((node) => {
    if (node.isText) text += node.text
    else if (node.type.name === 'workflow') {
      const { id, name, unavailable } = node.attrs
      if (typeof id === 'string' && typeof name === 'string')
        references.push({
          id,
          name,
          textOffset: text.length,
          ...(unavailable === true ? { unavailable: true } : {})
        })
    }
  })
  return { text, references }
}

export function promptTextOffset(doc: Node, position: number): number {
  return doc.textBetween(0, position, '', '').length
}

export function promptDocumentPosition(doc: Node, textOffset: number): number {
  let text = 0
  let position = 0
  doc.forEach((node, offset) => {
    if (node.isText && textOffset >= text && textOffset <= text + node.nodeSize)
      position = offset + textOffset - text
    else if (!node.isText && textOffset === text)
      position = offset + node.nodeSize
    if (node.isText) text += node.nodeSize
  })
  return position
}
