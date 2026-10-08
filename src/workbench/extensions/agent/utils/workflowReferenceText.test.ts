import { describe, expect, it } from 'vitest'

import {
  parseWorkflowReferences,
  serializeWorkflowReferences
} from './workflowReferenceText'

describe('workflow reference text', () => {
  it('preserves sentence order and distinct identities for matching names', () => {
    const references = [
      { id: 'a', name: 'Lighting', textOffset: 5 },
      { id: 'b', name: 'Lighting', textOffset: 11 }
    ]
    const text = 'Copy  into .'
    const content = serializeWorkflowReferences(text, references)

    expect(content).toBe(
      'Copy [Lighting](workflow://a) into [Lighting](workflow://b).'
    )
    expect(
      parseWorkflowReferences(
        content,
        references.map(({ id, name }) => ({ id, name }))
      )
    ).toEqual({ text, references })
  })

  it('roundtrips escaped names, Unicode, newlines and adjacent references', () => {
    const references = [
      { id: 'a/()#', name: 'A [v2] \\ draft', textOffset: 0 },
      { id: 'b', name: '🎨', textOffset: 0 },
      { id: 'c', name: 'End', textOffset: 3 }
    ]
    const text = '😀\n'
    expect(
      parseWorkflowReferences(
        serializeWorkflowReferences(text, references),
        references.map(({ id, name }) => ({ id, name }))
      )
    ).toEqual({ text, references })
  })

  it('preserves legacy text and unattached or malformed links verbatim', () => {
    const text = 'See [Unknown](workflow://other) and [broken](workflow://%ZZ).'
    const references = [{ id: 'a', name: 'Attached' }]
    expect(parseWorkflowReferences(text, references)).toEqual({
      text,
      references: [{ id: 'a', name: 'Attached', textOffset: 0 }]
    })
  })

  it('uses one position for legacy references through restoration and resend', () => {
    const restored = parseWorkflowReferences('Explain this', [
      { id: 'a', name: 'Legacy' }
    ])

    expect(restored.references).toEqual([
      { id: 'a', name: 'Legacy', textOffset: 0 }
    ])
    expect(
      serializeWorkflowReferences(restored.text, restored.references)
    ).toBe('[Legacy](workflow://a)Explain this')
    expect(
      parseWorkflowReferences(
        serializeWorkflowReferences(restored.text, restored.references),
        [{ id: 'a', name: 'Legacy' }]
      )
    ).toEqual(restored)
  })

  it('keeps the sent name and unavailable status when restoring a reference', () => {
    expect(
      parseWorkflowReferences('Use [Original](workflow://a).', [
        { id: 'a', name: 'Renamed', unavailable: true }
      ])
    ).toEqual({
      text: 'Use .',
      references: [
        { id: 'a', name: 'Original', unavailable: true, textOffset: 4 }
      ]
    })
  })
})
