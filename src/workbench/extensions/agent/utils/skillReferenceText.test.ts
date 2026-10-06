import { describe, expect, it } from 'vitest'

import { agentMessageText } from './agentMessageText'
import {
  parseSkillReferenceText,
  serializeSkillReference
} from './skillReferenceText'
import { composerPromptForSubmission } from './composerPrompt'
import {
  parseWorkflowReferences,
  serializeWorkflowReferences
} from './workflowReferenceText'

describe('skill references in ordinary message content', () => {
  it('sends a skill alongside workflow, node and asset references using their existing transport', () => {
    const result = composerPromptForSubmission({
      text: 'Use  and.',
      references: [
        { kind: 'workflow', id: 'wf', name: 'Reference', textOffset: 0 },
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
        {
          kind: 'asset',
          attachment: { id: 'asset', name: 'image.png', ref: 'uploaded.png' },
          textOffset: 8
        }
      ]
    })
    expect(result).toEqual({
      text: 'Use @[Node: KSampler #12][Use the saved skill /portrait](skill://portrait?description=Defaults) and@[Image: image.png].',
      workflowReferences: [{ id: 'wf', name: 'Reference', textOffset: 0 }]
    })
  })
  it('preserves canonical names and escaped display descriptions without an instruction body', () => {
    const skill = {
      name: 'Portrait.v2_Custom-Style',
      description: 'Use (defaults) [today] & 日本語\nKeep details 🖼️'
    }
    const content = `Before ${serializeSkillReference(skill)} after`
    const snapshot = parseSkillReferenceText(content)
    expect(content).toContain('Use the saved skill /Portrait.v2_Custom-Style')
    expect(content).toContain('%28defaults%29')
    expect(snapshot).toEqual({
      text: 'Before  after',
      workflowReferences: [],
      skillReference: { ...skill, textOffset: 7, workflowIndex: 0 }
    })
    expect(agentMessageText(snapshot)).toBe(
      'Before /Portrait.v2_Custom-Style after'
    )
  })

  it.for([
    '/portrait render it',
    '[portrait](skill://portrait)',
    '[Use the saved skill /portrait](https://portrait?description=Use%20defaults)',
    '[Use the saved skill /portrait](skill://other?description=Use%20defaults)',
    '[Use the saved skill /..](skill://..?description=Use%20defaults)',
    '[Use the saved skill /portrait](skill://portrait?description=%E0%A4)',
    '[Use the saved skill /portrait](skill://portrait?description=Use+defaults)',
    serializeSkillReference({ name: 'a'.repeat(65), description: 'Too long' }),
    serializeSkillReference({ name: 'portrait', description: '🖼'.repeat(1025) })
  ])('keeps ordinary or malformed content readable: %s', (content) => {
    expect(parseSkillReferenceText(content)).toEqual({
      text: content,
      workflowReferences: []
    })
  })

  it('restores at most one skill and retains any additional invocation as readable text', () => {
    const first = serializeSkillReference({
      name: 'portrait',
      description: 'Defaults'
    })
    const second = serializeSkillReference({
      name: 'landscape',
      description: 'More defaults'
    })
    const snapshot = parseSkillReferenceText(`${first} then ${second}`)
    expect(snapshot.text).toBe(` then ${second}`)
    expect(snapshot.skillReference?.name).toBe('portrait')
  })

  it.for([0, 1, 2])(
    'keeps the skill at workflow position %s through send, persistence and editing',
    (skillIndex) => {
      const workflows = [
        { kind: 'workflow' as const, id: 'a', name: 'A', textOffset: 4 },
        { kind: 'workflow' as const, id: 'b', name: 'B', textOffset: 4 }
      ]
      const references = [...workflows]
      const skill = {
        kind: 'skill' as const,
        name: 'portrait',
        description: 'Defaults',
        scope: 'user/workspace',
        textOffset: 4
      }
      const prompt = {
        text: 'Use  today',
        references: [
          ...references.slice(0, skillIndex),
          skill,
          ...references.slice(skillIndex)
        ]
      }
      const sent = composerPromptForSubmission(prompt)
      const content = serializeWorkflowReferences(
        sent.text,
        sent.workflowReferences
      )
      const metadata = workflows.map(
        ({ kind: _kind, textOffset: _offset, ...workflow }) => workflow
      )
      const restoredWorkflows = parseWorkflowReferences(content, metadata)
      const restored = parseSkillReferenceText(
        restoredWorkflows.text,
        restoredWorkflows.references
      )
      expect(restored.text).toBe(prompt.text)
      expect(restored.skillReference).toMatchObject({
        name: 'portrait',
        textOffset: 4,
        workflowIndex: skillIndex
      })
      expect(restored.workflowReferences).toEqual(
        workflows.map(({ kind: _kind, ...workflow }) => workflow)
      )
      const expected = ['@[Workflow: A]', '@[Workflow: B]']
      expected.splice(skillIndex, 0, '/portrait')
      expect(agentMessageText(restored)).toBe(`Use ${expected.join('')} today`)
    }
  )
})
