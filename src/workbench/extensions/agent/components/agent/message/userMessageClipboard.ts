import { DOMParser, DOMSerializer } from '@tiptap/pm/model'

import { agentMessageText } from '../../../utils/agentMessageText'
import {
  inlinePromptSchema,
  promptDocument,
  promptDraft
} from '../composer/inlinePrompt'

export function userMessageClipboard(
  message: Parameters<typeof agentMessageText>[0]
) {
  const { text, workflowReferences = [] } = message
  const plainText = agentMessageText(message)
  const prompt = promptDocument({
    text,
    references: [...workflowReferences]
      .sort((a, b) => a.textOffset - b.textOffset)
      .map((reference) => ({ ...reference, kind: 'workflow' }))
  })
  const container = document.createElement('span')
  container.style.whiteSpace = 'pre-wrap'
  container.append(
    DOMSerializer.fromSchema(inlinePromptSchema).serializeFragment(
      prompt.content
    ),
    plainText.slice(agentMessageText({ text, workflowReferences }).length)
  )
  return { text: plainText, html: container.outerHTML }
}

export function selectedUserMessageClipboard(
  bubble: HTMLElement,
  selection: Selection | null
) {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return
  const range = selection.getRangeAt(0).cloneRange()
  if (
    !bubble.contains(range.startContainer) ||
    !bubble.contains(range.endContainer)
  )
    return

  for (const chip of bubble.querySelectorAll('[data-comfy-workflow="1"]')) {
    if (chip.contains(range.startContainer)) range.setStartBefore(chip)
    if (chip.contains(range.endContainer)) range.setEndAfter(chip)
  }
  const prompt = promptDraft(
    DOMParser.fromSchema(inlinePromptSchema).parse(range.cloneContents(), {
      preserveWhitespace: 'full'
    })
  )
  const workflowReferences = prompt.references.filter(
    (reference) => reference.kind === 'workflow'
  )
  if (!workflowReferences.length) return
  return userMessageClipboard({ text: prompt.text, workflowReferences })
}
