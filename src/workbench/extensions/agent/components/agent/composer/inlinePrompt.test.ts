import { DOMParser } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'

import { parseWorkflowReferences } from '../../../utils/workflowReferenceText'

import {
  inlinePromptSchema,
  promptDocument,
  promptDocumentPosition,
  promptDraft,
  promptTextOffset
} from './inlinePrompt'

describe('inline workflow prompt', () => {
  it('normalizes clipboard workflow IDs while preserving labels and availability', () => {
    const content = document.createElement('div')
    const chip = document.createElement('span')
    chip.dataset.comfyWorkflow = '1'
    chip.dataset.workflowId = ' \tworkflow-B\n '
    chip.dataset.workflowUnavailable = 'true'
    chip.textContent = ' Reference B '
    content.append(chip)

    const doc = DOMParser.fromSchema(inlinePromptSchema).parse(content)

    expect(doc.firstChild?.attrs).toEqual({
      id: 'workflow-B',
      name: ' Reference B ',
      unavailable: true
    })
  })

  it('restores references before, between and after text, including adjacent tokens', () => {
    const draft = {
      text: 'before 😀\nafter',
      references: [
        { id: 'a', name: 'A', textOffset: 0 },
        { id: 'b', name: 'B', textOffset: 7, unavailable: true },
        { id: 'c', name: 'C', textOffset: 7 },
        { id: 'd', name: 'D', textOffset: 15 }
      ]
    }
    const doc = promptDocument(draft.text, draft.references)
    expect(
      doc.textBetween(0, doc.content.size, '', (node) =>
        String(node.attrs.name)
      )
    ).toBe('Abefore BC😀\nafterD')
    expect(promptDraft(doc)).toEqual(draft)
  })

  it('moves a token with preceding edits and removes it with a spanning selection', () => {
    let state = EditorState.create({
      doc: promptDocument('before  after', [
        { id: 'b', name: 'B', textOffset: 7 }
      ])
    })
    state = state.apply(state.tr.insertText('new ', 0))
    expect(promptDraft(state.doc)).toEqual({
      text: 'new before  after',
      references: [{ id: 'b', name: 'B', textOffset: 11 }]
    })
    const afterToken = promptDocumentPosition(state.doc, 11)
    expect(promptTextOffset(state.doc, afterToken)).toBe(11)
    state = state.apply(state.tr.delete(0, afterToken))
    expect(promptDraft(state.doc)).toEqual({ text: ' after', references: [] })
  })

  it('opens older drafts without recorded positions without losing references', () => {
    const restored = parseWorkflowReferences('prompt', [{ id: 'b', name: 'B' }])
    expect(
      promptDraft(promptDocument(restored.text, restored.references))
    ).toEqual({
      text: 'prompt',
      references: [{ id: 'b', name: 'B', textOffset: 0 }]
    })
  })
})
