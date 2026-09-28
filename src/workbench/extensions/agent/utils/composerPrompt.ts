import type {
  ComposerInsertionPoint,
  ComposerPrompt,
  ComposerReference
} from '../types/composerPrompt'
import {
  composerReferenceKey,
  composerReferenceName
} from '../types/composerPrompt'
import type { PromptSnapshot } from '../types/workflowReference'
import { assetReferenceText, nodeReferenceText } from './agentMessageText'

export function insertComposerReference(
  prompt: ComposerPrompt,
  reference: ComposerReference,
  insertion: ComposerInsertionPoint
): { prompt: ComposerPrompt; insertion: ComposerInsertionPoint } {
  const textOffset = Math.min(
    prompt.text.length,
    Math.max(0, insertion.textOffset)
  )
  const referenceIndex = Math.min(
    prompt.references.length,
    Math.max(0, insertion.referenceIndex)
  )
  const needsSpace = prompt.text[textOffset] !== ' '
  const references = prompt.references.map((item, index) => ({
    ...item,
    textOffset:
      needsSpace &&
      (item.textOffset > textOffset ||
        (item.textOffset === textOffset && index >= referenceIndex))
        ? item.textOffset + 1
        : item.textOffset
  }))
  references.splice(referenceIndex, 0, { ...reference, textOffset })
  return {
    prompt: {
      text: needsSpace
        ? `${prompt.text.slice(0, textOffset)} ${prompt.text.slice(textOffset)}`
        : prompt.text,
      references
    },
    insertion: {
      textOffset: textOffset + 1,
      referenceIndex: referenceIndex + 1
    }
  }
}

export function composerPromptForSend(prompt: ComposerPrompt): PromptSnapshot {
  let text = ''
  let offset = 0
  const workflowReferences: PromptSnapshot['workflowReferences'] = []
  for (const reference of prompt.references) {
    text += prompt.text.slice(offset, reference.textOffset)
    offset = reference.textOffset
    if (reference.kind === 'workflow') {
      const { kind: _kind, ...workflow } = reference
      workflowReferences.push({ ...workflow, textOffset: text.length })
    } else {
      const name = composerReferenceName(reference)
      text +=
        reference.kind === 'node'
          ? nodeReferenceText(name)
          : assetReferenceText(name)
    }
  }
  return { text: text + prompt.text.slice(offset), workflowReferences }
}

export function sameComposerReferenceOrder(
  a: ComposerPrompt,
  b: ComposerPrompt
): boolean {
  return (
    a.references.length === b.references.length &&
    a.references.every(
      (reference, index) =>
        composerReferenceKey(reference) ===
        composerReferenceKey(b.references[index])
    )
  )
}
