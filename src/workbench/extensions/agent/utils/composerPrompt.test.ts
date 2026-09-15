import { describe, expect, it } from 'vitest'

import type { ComposerPrompt } from '../types/composerPrompt'
import {
  composerPromptForSend,
  insertComposerReference
} from './composerPrompt'

describe('composer prompt boundaries', () => {
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
