import { describe, expect, it } from 'vitest'

import { composerPromptForSubmission } from './composerPrompt'
import {
  parseSkillReferenceText,
  serializeSkillReference
} from './skillReferenceText'
import {
  parseWorkflowReferences,
  serializeWorkflowReferences
} from './workflowReferenceText'

describe('skill references in ordinary message content', () => {
  it('serializes the canonical link and roundtrips it', () => {
    const skill = { name: 'portrait', description: 'Original description' }
    const content = serializeSkillReference(skill)
    expect(content).toBe(
      '[Use the saved skill /portrait](skill://portrait?description=Original%20description)'
    )
    expect(parseSkillReferenceText(content).skillReference).toEqual({
      ...skill,
      textOffset: 0,
      workflowIndex: 0
    })
  })

  it('restores a legacy link carrying an ID as the same name-only reference', () => {
    const snapshot = parseSkillReferenceText(
      'Use [Use the saved skill /portrait](skill://portrait?description=Original%20description&id=876ba965-32ec-4fad-9a3f-913c2f43bb57) now'
    )
    expect(snapshot).toEqual({
      text: 'Use  now',
      workflowReferences: [],
      skillReference: {
        name: 'portrait',
        description: 'Original description',
        textOffset: 4,
        workflowIndex: 0
      }
    })
  })

  it('escapes link syntax in descriptions and roundtrips any valid name and description', () => {
    const skill = {
      name: 'Portrait.v2_Custom-Style',
      description: 'Use (defaults) [today] & 日本語\nKeep details 🖼️'
    }
    const content = `Before ${serializeSkillReference(skill)} after`
    expect(content).toContain('%28defaults%29')
    expect(parseSkillReferenceText(content)).toEqual({
      text: 'Before  after',
      workflowReferences: [],
      skillReference: { ...skill, textOffset: 7, workflowIndex: 0 }
    })
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
    serializeSkillReference({
      name: 'portrait',
      description: '🖼'.repeat(1025)
    }),
    '[Use the saved skill /portrait](skill://portrait?description=Original&id=original-id&unavailable=1)',
    '[Use the saved skill /portrait](skill://portrait?description=Original&id=)',
    '[Use the saved skill /portrait](skill://portrait?description=Original&id=a%20b)'
  ])('keeps ordinary or malformed content readable: %s', (content) => {
    expect(parseSkillReferenceText(content)).toEqual({
      text: content,
      workflowReferences: []
    })
  })

  it('restores at most one skill and retains any additional invocation as readable text', () => {
    const second =
      '[Use the saved skill /landscape](skill://landscape?description=More%20defaults)'
    const snapshot = parseSkillReferenceText(
      `[Use the saved skill /portrait](skill://portrait?description=Defaults) then ${second}`
    )
    expect(snapshot.text).toBe(` then ${second}`)
    expect(snapshot.skillReference?.name).toBe('portrait')
  })

  it('keeps a skill between adjacent workflows through send, persistence and editing', () => {
    const sent = composerPromptForSubmission({
      text: 'Use  today',
      references: [
        { kind: 'workflow', id: 'a', name: 'A', textOffset: 4 },
        {
          kind: 'skill',
          name: 'portrait',
          description: 'Defaults',
          scope: 'user/workspace',
          textOffset: 4
        },
        { kind: 'workflow', id: 'b', name: 'B', textOffset: 4 }
      ]
    })
    const content = serializeWorkflowReferences(
      sent.text,
      sent.workflowReferences
    )
    expect(content).toBe(
      'Use [A](workflow://a)[Use the saved skill /portrait](skill://portrait?description=Defaults)[B](workflow://b) today'
    )
    const workflows = parseWorkflowReferences(content, [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ])
    const restored = parseSkillReferenceText(
      workflows.text,
      workflows.references
    )
    expect(restored).toEqual({
      text: 'Use  today',
      workflowReferences: [
        { id: 'a', name: 'A', textOffset: 4 },
        { id: 'b', name: 'B', textOffset: 4 }
      ],
      skillReference: {
        name: 'portrait',
        description: 'Defaults',
        textOffset: 4,
        workflowIndex: 1
      }
    })
  })
})
