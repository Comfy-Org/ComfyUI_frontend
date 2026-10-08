import { describe, expect, it } from 'vitest'

import { useAgentComposerStore } from '../stores/agent/agentComposerStore'
import { agentMessageText } from './agentMessageText'
import { parseSkillReferenceText } from './skillReferenceText'
import type { ComposerPrompt } from '../types/composerPrompt'
import {
  composerPromptForSend,
  composerPromptForSubmission,
  insertComposerReference
} from './composerPrompt'

describe('composer prompt boundaries', () => {
  it('submits the reference’s own name and description without changing snapshots or adjacent workflow order', () => {
    const prompt: ComposerPrompt = {
      text: 'Use  now',
      references: [
        {
          kind: 'skill',
          name: 'old',
          description: 'Original description',
          scope: 'scope',
          textOffset: 4
        },
        { kind: 'workflow', id: 'workflow', name: 'Reference', textOffset: 4 }
      ]
    }
    const original = structuredClone(prompt)
    const submitted = composerPromptForSubmission(prompt)
    const marker =
      '[Use the saved skill /old](skill://old?description=Original%20description)'
    expect(submitted).toEqual({
      text: `Use ${marker} now`,
      workflowReferences: [
        { id: 'workflow', name: 'Reference', textOffset: 4 + marker.length }
      ]
    })
    expect(
      parseSkillReferenceText(submitted.text, submitted.workflowReferences)
    ).toEqual({
      text: 'Use  now',
      workflowReferences: [
        { id: 'workflow', name: 'Reference', textOffset: 4 }
      ],
      skillReference: {
        name: 'old',
        description: 'Original description',
        textOffset: 4,
        workflowIndex: 0
      }
    })
    expect(prompt).toEqual(original)
  })

  it('keeps pending pasted-name resolution draft-only while preserving the display snapshot', () => {
    const snapshot = composerPromptForSend({
      text: ' colors',
      references: [
        {
          kind: 'skill',
          name: 'portrait',
          description: 'Original',
          scope: 'scope',
          resolvePastedName: true,
          textOffset: 0
        }
      ]
    })
    expect(snapshot.skillReference).toEqual({
      name: 'portrait',
      description: 'Original',
      textOffset: 0,
      workflowIndex: 0
    })
    expect(snapshot.skillReference).not.toHaveProperty('resolvePastedName')
  })

  it.for<{
    order: string
    references: ComposerPrompt['references']
    rendered: string
    kinds: ComposerPrompt['references'][number]['kind'][]
  }>([
    {
      order: 'skill-first',
      references: [
        {
          kind: 'skill',
          name: 'portrait',
          description: 'Use defaults',
          scope: 'scope',
          textOffset: 0
        },
        { kind: 'workflow', id: 'workflow', name: 'Reference', textOffset: 0 }
      ],
      rendered: '/portrait@[Workflow: Reference]',
      kinds: ['skill', 'workflow']
    },
    {
      order: 'workflow-first',
      references: [
        { kind: 'workflow', id: 'workflow', name: 'Reference', textOffset: 0 },
        {
          kind: 'skill',
          name: 'portrait',
          description: 'Use defaults',
          scope: 'scope',
          textOffset: 0
        }
      ],
      rendered: '@[Workflow: Reference]/portrait',
      kinds: ['workflow', 'skill']
    }
  ])(
    'preserves adjacent cross-kind order through render, edit and draft restoration: $order',
    ({ references, rendered, kinds }) => {
      const snapshot = composerPromptForSend({ text: '', references })
      expect(agentMessageText(snapshot)).toBe(rendered)
      const store = useAgentComposerStore()
      store.setSkillScope('scope')
      store.replacePrompt(snapshot)
      expect(store.prompt.references.map((item) => item.kind)).toEqual(kinds)
      store.replaceDraft({ ...snapshot, attachments: [] })
      expect(store.prompt.references.map((item) => item.kind)).toEqual(kinds)
    }
  )
  it('retains skill identity and its adjusted position without expanding it to ordinary prompt text', () => {
    const asset = {
      kind: 'asset' as const,
      attachment: { id: 'asset', name: 'image.png', ref: 'image.png' },
      textOffset: 0
    }
    expect(
      composerPromptForSend({
        text: ' then render',
        references: [
          asset,
          asset,
          {
            kind: 'skill',
            name: 'portrait',
            description: 'Use portrait defaults',
            scope: 'user/workspace',
            textOffset: 6
          }
        ]
      })
    ).toEqual({
      text: '@[Image: image.png]@[Image: image.png] then render',
      workflowReferences: [],
      skillReference: {
        name: 'portrait',
        description: 'Use portrait defaults',
        textOffset: 44,
        workflowIndex: 0
      }
    })
  })
  it('expands node and asset labels while retaining the workflow position', () => {
    const prompt: ComposerPrompt = {
      text: 'Use  with  in .',
      references: [
        {
          kind: 'node',
          scope: 'A',
          node: { id: '12', title: 'KSampler' },
          textOffset: 4
        },
        {
          kind: 'asset',
          attachment: { id: 'asset', name: 'source.png', ref: 'uploaded.png' },
          textOffset: 10
        },
        { kind: 'workflow', id: 'B', name: 'Portrait', textOffset: 14 }
      ]
    }
    expect(composerPromptForSend(prompt)).toEqual({
      text: 'Use @[Node: KSampler #12] with @[Image: source.png] in .',
      workflowReferences: [{ id: 'B', name: 'Portrait', textOffset: 55 }]
    })
  })

  it('inserts between adjacent references and makes room for the following cursor', () => {
    const prompt: ComposerPrompt = {
      text: 'Use .',
      references: [
        { kind: 'workflow', id: 'A', name: 'First', textOffset: 4 },
        { kind: 'workflow', id: 'B', name: 'Last', textOffset: 4 }
      ]
    }
    expect(
      insertComposerReference(
        prompt,
        {
          kind: 'node',
          scope: 'A',
          node: { id: '12', title: 'KSampler' },
          textOffset: 0
        },
        { textOffset: 4, referenceIndex: 1 }
      )
    ).toEqual({
      prompt: {
        text: 'Use  .',
        references: [
          prompt.references[0],
          {
            kind: 'node',
            scope: 'A',
            node: { id: '12', title: 'KSampler' },
            textOffset: 4
          },
          { ...prompt.references[1], textOffset: 5 }
        ]
      },
      insertion: { textOffset: 5, referenceIndex: 2 }
    })
  })
})
