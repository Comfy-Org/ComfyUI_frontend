import type { SelectedNode } from '../composables/agent/useCanvasSelection'
import { selectedNodeKey } from '../composables/agent/useCanvasSelection'
import type { ComposerAttachment } from '../composables/agent/useComposer'
import type { WorkflowReference } from './workflowReference'

export type ComposerReference =
  | (WorkflowReference & { kind: 'workflow' })
  | {
      kind: 'node'
      node: SelectedNode
      scope: string
      textOffset: number
    }
  | {
      kind: 'asset'
      attachment: ComposerAttachment
      textOffset: number
    }

export interface ComposerPrompt {
  text: string
  references: ComposerReference[]
}

export interface ComposerInsertionPoint {
  textOffset: number
  referenceIndex: number
}

export function composerReferenceKey(reference: ComposerReference): string {
  switch (reference.kind) {
    case 'workflow':
      return `workflow:${reference.id}`
    case 'node':
      return `node:${JSON.stringify([reference.scope, selectedNodeKey(reference.node)])}`
    case 'asset':
      return `asset:${reference.attachment.id}`
  }
}

export function composerReferenceName(reference: ComposerReference): string {
  switch (reference.kind) {
    case 'workflow':
      return reference.name
    case 'node':
      return `${reference.node.title} #${reference.node.id}`
    case 'asset':
      return reference.attachment.name
  }
}
