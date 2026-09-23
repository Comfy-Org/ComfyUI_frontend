import { Schema } from '@tiptap/pm/model'
import type { Node } from '@tiptap/pm/model'

import { isNodeLocatorId } from '@/types/nodeIdentification'
import type {
  ComposerInsertionPoint,
  ComposerPrompt,
  ComposerReference
} from '../../../types/composerPrompt'
import {
  assetReferenceText,
  nodeReferenceText
} from '../../../utils/agentMessageText'

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
    },
    node: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: { id: {}, name: {}, scope: {}, locatorId: { default: null } },
      toDOM: (node) => [
        'span',
        { 'data-node-id': node.attrs.id },
        nodeReferenceText(`${node.attrs.name} #${node.attrs.id}`)
      ]
    },
    asset: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        id: {},
        name: {},
        ref: {},
        previewUrl: { default: null },
        uploading: { default: false }
      },
      toDOM: (node) => [
        'span',
        { 'data-asset-id': node.attrs.id },
        assetReferenceText(node.attrs.name)
      ]
    }
  }
})

function promptReferenceNode(reference: ComposerReference): Node {
  switch (reference.kind) {
    case 'workflow':
      return inlinePromptSchema.nodes.workflow.create({
        id: reference.id,
        name: reference.name,
        unavailable: reference.unavailable === true
      })
    case 'node':
      return inlinePromptSchema.nodes.node.create({
        id: reference.node.id,
        name: reference.node.title,
        locatorId: reference.node.locatorId,
        scope: reference.scope
      })
    case 'asset':
      return inlinePromptSchema.nodes.asset.create({ ...reference.attachment })
  }
}

export function promptDocument(prompt: ComposerPrompt): Node {
  const content: Node[] = []
  let offset = 0
  for (const reference of prompt.references) {
    const next = Math.max(
      offset,
      Math.min(prompt.text.length, reference.textOffset)
    )
    if (next > offset)
      content.push(inlinePromptSchema.text(prompt.text.slice(offset, next)))
    content.push(promptReferenceNode(reference))
    offset = next
  }
  if (offset < prompt.text.length)
    content.push(inlinePromptSchema.text(prompt.text.slice(offset)))
  return inlinePromptSchema.nodes.doc.create(null, content)
}

export function promptNodeReference(
  node: Node,
  textOffset: number
): ComposerReference | undefined {
  const { id, name } = node.attrs
  if (typeof id !== 'string' || typeof name !== 'string') return
  if (node.type.name === 'workflow')
    return {
      kind: 'workflow',
      id,
      name,
      textOffset,
      ...(node.attrs.unavailable === true ? { unavailable: true } : {})
    }
  if (node.type.name === 'node') {
    const { scope, locatorId } = node.attrs
    if (typeof scope !== 'string') return
    return {
      kind: 'node',
      scope,
      textOffset,
      node: {
        id,
        title: name,
        ...(isNodeLocatorId(locatorId) ? { locatorId } : {})
      }
    }
  }
  if (node.type.name === 'asset') {
    const { ref, previewUrl, uploading } = node.attrs
    if (typeof ref !== 'string') return
    return {
      kind: 'asset',
      textOffset,
      attachment: {
        id,
        name,
        ref,
        ...(typeof previewUrl === 'string' ? { previewUrl } : {}),
        ...(uploading === true ? { uploading: true } : {})
      }
    }
  }
}

export function promptDraft(doc: Node): ComposerPrompt {
  let text = ''
  const references: ComposerReference[] = []
  doc.forEach((node) => {
    if (node.isText) text += node.text
    else {
      const reference = promptNodeReference(node, text.length)
      if (reference) references.push(reference)
    }
  })
  return { text, references }
}

export function promptTextOffset(doc: Node, position: number): number {
  return doc.textBetween(0, position, '', '').length
}

export function promptInsertionPoint(
  doc: Node,
  position: number
): ComposerInsertionPoint {
  let referenceIndex = 0
  doc.forEach((node, offset) => {
    if (!node.isText && offset < position) referenceIndex++
  })
  return { textOffset: promptTextOffset(doc, position), referenceIndex }
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
