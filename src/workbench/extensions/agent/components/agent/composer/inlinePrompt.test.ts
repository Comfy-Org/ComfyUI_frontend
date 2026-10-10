import { DOMParser } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import type { ComposerPrompt } from '../../../types/composerPrompt'
import { parseWorkflowReferences } from '../../../utils/workflowReferenceText'

import {
  inlinePromptSchema,
  pastedSkillCommand,
  promptDocument,
  promptDocumentPosition,
  promptDraft,
  promptTextOffset
} from './inlinePrompt'

function pastedSkillChip(dataset: Record<string, string>, label: string) {
  const content = document.createElement('div')
  const chip = document.createElement('span')
  Object.assign(chip.dataset, { comfySkill: '1', ...dataset })
  chip.textContent = label
  content.append(chip)
  return promptDraft(DOMParser.fromSchema(inlinePromptSchema).parse(content))
}

describe('inline prompt', () => {
  it.for([
    ['', 0, { name: 'portrait', suffix: ' next' }],
    ['src', 3, undefined],
    ['src ', 4, { name: 'portrait', suffix: ' next' }],
    ['line\n', 5, { name: 'portrait', suffix: ' next' }],
    ['src', 0, { name: 'portrait', suffix: ' next' }]
  ] as const)(
    'accepts a pasted skill command only at the text start or after whitespace: %j at %i',
    ([text, offset, expected]) => {
      const doc = promptDocument({
        text,
        references: [
          { kind: 'workflow', id: 'ref', name: 'Reference', textOffset: 0 }
        ]
      })
      const position = promptDocumentPosition(doc, offset)
      expect(pastedSkillCommand(doc, position, '/portrait next')).toEqual(
        expected
      )
    }
  )

  it('round-trips a scoped skill and its pending paste resolution beside a workflow', () => {
    const draft: ComposerPrompt = {
      text: '😀 before  after',
      references: [
        { kind: 'workflow', id: 'ref', name: 'Reference', textOffset: 10 },
        {
          kind: 'skill',
          name: 'portrait',
          description: 'Private\nDescription',
          scope: 'user-a/workspace-a',
          resolvePastedName: true,
          textOffset: 10
        }
      ]
    }
    expect(promptDraft(promptDocument(draft))).toEqual(draft)
  })

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

  it.for(['portrait.v2', 'a'.repeat(64)])(
    'accepts valid rich skill display metadata for %s',
    (name) => {
      const prompt = pastedSkillChip(
        { skillName: name, skillDescription: 'Original\nDescription' },
        `/${name}`
      )
      expect(prompt.references).toEqual([
        {
          kind: 'skill',
          name,
          description: 'Original\nDescription',
          scope: '',
          textOffset: 0
        }
      ])
    }
  )

  it.for([
    [
      { skillName: 'a'.repeat(65), skillDescription: 'x' },
      `/${'a'.repeat(65)}`
    ],
    [
      { skillName: 'portrait', skillDescription: 'a'.repeat(1025) },
      '/portrait'
    ],
    [{ skillName: '..', skillDescription: 'x' }, '/..'],
    [{ skillName: 'portrait' }, '/portrait'],
    [{ skillName: 'portrait', skillDescription: 'x' }, '/different']
  ] as const)(
    'keeps malformed rich skill metadata as readable text: %j',
    ([dataset, label]) => {
      expect(pastedSkillChip(dataset, label)).toEqual({
        text: label,
        references: []
      })
    }
  )

  it.for([true, false])(
    'round-trips adjacent scoped nodes and assets with uploading=%s',
    (uploading) => {
      const draft: ComposerPrompt = {
        text: 'before 😀 after',
        references: [
          {
            kind: 'node',
            textOffset: 7,
            scope: 'workflow-A',
            node: {
              id: '12',
              title: 'KSampler',
              locatorId: createNodeLocatorId(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                toNodeId('12')
              )
            }
          },
          {
            kind: 'asset',
            textOffset: 7,
            attachment: {
              id: 'image',
              name: 'source.png',
              ref: uploading ? '' : 'uploaded.png',
              previewUrl: 'blob:source',
              ...(uploading ? { uploading: true } : {})
            }
          }
        ]
      }

      expect(promptDraft(promptDocument(draft))).toEqual(draft)
    }
  )

  it.for(['video', 'audio'] as const)(
    'retains $mediaKind preview metadata when round-tripping inline assets',
    (mediaKind) => {
      const draft: ComposerPrompt = {
        text: 'Inspect ',
        references: [
          {
            kind: 'asset',
            textOffset: 8,
            attachment: {
              id: 'media',
              name: 'Renamed media',
              ref: 'stored-file',
              mediaKind,
              mediaUrl: 'blob:media',
              previewUrl: '/poster.png',
              uploading: true
            }
          }
        ]
      }
      expect(promptDraft(promptDocument(draft))).toEqual(draft)
    }
  )

  it('restores references before, between and after text, including adjacent tokens', () => {
    const draft: ComposerPrompt = {
      text: 'before 😀\nafter',
      references: [
        { kind: 'workflow', id: 'a', name: 'A', textOffset: 0 },
        {
          kind: 'workflow',
          id: 'b',
          name: 'B',
          textOffset: 7,
          unavailable: true
        },
        { kind: 'workflow', id: 'c', name: 'C', textOffset: 7 },
        { kind: 'workflow', id: 'd', name: 'D', textOffset: 15 }
      ]
    }
    const doc = promptDocument(draft)
    expect(
      doc.textBetween(0, doc.content.size, '', (node) =>
        String(node.attrs.name)
      )
    ).toBe('Abefore BC😀\nafterD')
    expect(promptDraft(doc)).toEqual(draft)
  })

  it('moves a token with preceding edits and removes it with a spanning selection', () => {
    let state = EditorState.create({
      doc: promptDocument({
        text: 'before  after',
        references: [{ kind: 'workflow', id: 'b', name: 'B', textOffset: 7 }]
      })
    })
    state = state.apply(state.tr.insertText('new ', 0))
    expect(promptDraft(state.doc)).toEqual({
      text: 'new before  after',
      references: [{ kind: 'workflow', id: 'b', name: 'B', textOffset: 11 }]
    })
    const afterToken = promptDocumentPosition(state.doc, 11)
    expect(promptTextOffset(state.doc, afterToken)).toBe(11)
    state = state.apply(state.tr.delete(0, afterToken))
    expect(promptDraft(state.doc)).toEqual({ text: ' after', references: [] })
  })

  it('opens older drafts without recorded positions without losing references', () => {
    const restored = parseWorkflowReferences('prompt', [{ id: 'b', name: 'B' }])
    expect(
      promptDraft(
        promptDocument({
          text: restored.text,
          references: restored.references.map((reference) => ({
            ...reference,
            kind: 'workflow'
          }))
        })
      )
    ).toEqual({
      text: 'prompt',
      references: [{ kind: 'workflow', id: 'b', name: 'B', textOffset: 0 }]
    })
  })
})
