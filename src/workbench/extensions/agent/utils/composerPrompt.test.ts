import { describe, expect, it } from 'vitest'

import { useAgentComposerStore } from '../stores/agent/agentComposerStore'
import { agentMessageText } from './agentMessageText'
import type { ComposerPrompt, ComposerReference } from '../types/composerPrompt'
import {
  composerPromptForSend,
  composerPromptForSubmission,
  insertComposerReference
} from './composerPrompt'

describe('composer prompt boundaries', () => {
  it('submits the skill as a link among node, asset and workflow references and shifts later workflow offsets', () => {
    const prompt: ComposerPrompt = {
      text: 'Use  and.',
      references: [
        {
          kind: 'node',
          scope: 'target',
          node: { id: '12', title: 'KSampler' },
          textOffset: 4
        },
        {
          kind: 'skill',
          name: 'portrait',
          description: 'Defaults',
          scope: 'user/workspace',
          textOffset: 4
        },
        { kind: 'workflow', id: 'wf', name: 'Reference', textOffset: 4 },
        {
          kind: 'asset',
          attachment: { id: 'asset', name: 'image.png', ref: 'uploaded.png' },
          textOffset: 8
        }
      ]
    }
    const original = structuredClone(prompt)
    expect(composerPromptForSubmission(prompt)).toEqual({
      text: 'Use @[Node: KSampler #12][Use the saved skill /portrait](skill://portrait?description=Defaults) and@[Image: image.png].',
      workflowReferences: [{ id: 'wf', name: 'Reference', textOffset: 95 }]
    })
    expect(prompt).toEqual(original)
  })

  it('drops draft-only paste resolution from the sent skill snapshot', () => {
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
  })

  const skill: ComposerReference = {
    kind: 'skill',
    name: 'portrait',
    description: 'Use defaults',
    scope: 'scope',
    textOffset: 0
  }
  const workflow: ComposerReference = {
    kind: 'workflow',
    id: 'workflow',
    name: 'Reference',
    textOffset: 0
  }

  it.for([
    {
      order: 'skill-first',
      references: [skill, workflow],
      rendered: '/portrait@[Workflow: Reference]',
      kinds: ['skill', 'workflow']
    },
    {
      order: 'workflow-first',
      references: [workflow, skill],
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
