import { DOMParser, DOMSerializer } from '@tiptap/pm/model'

import { agentMessageText } from '../../../utils/agentMessageText'
import type { ComposerReference } from '../../../types/composerPrompt'
import { promptReferenceParts } from '../../../utils/promptReferenceParts'
import { composerPromptForSend } from '../../../utils/composerPrompt'
import {
  inlinePromptSchema,
  promptDocument,
  promptDraft
} from '../composer/inlinePrompt'

export function userMessageClipboard(
  message: Parameters<typeof agentMessageText>[0]
) {
  const { text, workflowReferences = [], skillReference } = message
  const plainText = agentMessageText(message)
  const prompt = promptDocument({
    text,
    references: promptReferenceParts(
      text,
      workflowReferences,
      skillReference
    ).flatMap((part): ComposerReference[] => {
      if (part.type === 'text') return []
      return part.type === 'workflow'
        ? [{ ...part.reference, kind: 'workflow' }]
        : [{ ...part.reference, kind: 'skill', scope: '' }]
    })
  })
  const container = document.createElement('span')
  container.style.whiteSpace = 'pre-wrap'
  container.append(
    DOMSerializer.fromSchema(inlinePromptSchema).serializeFragment(
      prompt.content
    ),
    plainText.slice(
      agentMessageText({ text, workflowReferences, skillReference }).length
    )
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

  for (const chip of bubble.querySelectorAll(
    '[data-comfy-workflow="1"], [data-comfy-skill="1"]'
  )) {
    if (chip.contains(range.startContainer)) range.setStartBefore(chip)
    if (chip.contains(range.endContainer)) range.setEndAfter(chip)
  }
  const selectedContent = range.cloneContents()
  for (const skill of selectedContent.querySelectorAll(
    '[data-comfy-skill="1"]'
  )) {
    const name = skill.getAttribute('data-skill-name')
    if (name !== null) skill.textContent = `/${name}`
  }
  const prompt = promptDraft(
    DOMParser.fromSchema(inlinePromptSchema).parse(selectedContent, {
      preserveWhitespace: 'full'
    })
  )
  if (!prompt.references.length) return
  return userMessageClipboard(composerPromptForSend(prompt))
}
