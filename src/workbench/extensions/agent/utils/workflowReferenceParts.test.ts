import { describe, expect, it } from 'vitest'

import type { WorkflowReference } from '../types/workflowReference'
import { workflowReferenceParts } from './workflowReferenceParts'

describe('workflowReferenceParts', () => {
  const leading: WorkflowReference = {
    id: 'a',
    name: 'Lighting',
    textOffset: 0
  }
  const middle: WorkflowReference = {
    id: 'a',
    name: 'Lighting',
    textOffset: 5
  }
  const negative: WorkflowReference = {
    id: 'a',
    name: 'Lighting',
    textOffset: -1
  }

  it.for([
    { name: 'empty text', text: '', expected: [] },
    {
      name: 'complete text with whitespace',
      text: '  Use this\n',
      expected: [{ type: 'text', text: '  Use this\n' }]
    }
  ])('returns $name with no references', ({ text, expected }) => {
    expect(workflowReferenceParts(text, [])).toEqual(expected)
  })

  it.for([
    {
      name: 'at the beginning',
      text: ' into the scene',
      reference: leading,
      expected: [
        { type: 'workflow', reference: leading },
        { type: 'text', text: ' into the scene' }
      ]
    },
    {
      name: 'in the middle with surrounding whitespace',
      text: 'Copy  into .',
      reference: middle,
      expected: [
        { type: 'text', text: 'Copy ' },
        { type: 'workflow', reference: middle },
        { type: 'text', text: ' into .' }
      ]
    },
    {
      name: 'before the complete text for a negative offset',
      text: 'Use this',
      reference: negative,
      expected: [
        { type: 'workflow', reference: negative },
        { type: 'text', text: 'Use this' }
      ]
    },
    {
      name: 'with empty text',
      text: '',
      reference: leading,
      expected: [{ type: 'workflow', reference: leading }]
    }
  ])('places one reference $name', ({ text, reference, expected }) => {
    expect(workflowReferenceParts(text, [reference])).toEqual(expected)
  })

  it('emits multiple references in textOffset order without mutating input', () => {
    const later: WorkflowReference = { id: 'b', name: 'B', textOffset: 11 }
    const earlier: WorkflowReference = { id: 'a', name: 'A', textOffset: 5 }
    const references = [later, earlier]

    expect(workflowReferenceParts('Copy  into .', references)).toEqual([
      { type: 'text', text: 'Copy ' },
      { type: 'workflow', reference: earlier },
      { type: 'text', text: ' into ' },
      { type: 'workflow', reference: later },
      { type: 'text', text: '.' }
    ])
    expect(references).toEqual([later, earlier])
  })

  it('keeps same-offset references adjacent without an empty text part', () => {
    const first: WorkflowReference = { id: 'a', name: 'A', textOffset: 0 }
    const second: WorkflowReference = { id: 'b', name: 'B', textOffset: 0 }

    expect(workflowReferenceParts('😀\n', [first, second])).toEqual([
      { type: 'workflow', reference: first },
      { type: 'workflow', reference: second },
      { type: 'text', text: '😀\n' }
    ])
  })

  it('treats textOffset as a UTF-16 index', () => {
    const afterEmoji: WorkflowReference = {
      id: 'a',
      name: 'A',
      textOffset: 2
    }

    expect(workflowReferenceParts('😀x', [afterEmoji])).toEqual([
      { type: 'text', text: '😀' },
      { type: 'workflow', reference: afterEmoji },
      { type: 'text', text: 'x' }
    ])
  })

  it('clamps offsets past the string', () => {
    const pastEnd: WorkflowReference = { id: 'b', name: 'B', textOffset: 99 }

    expect(workflowReferenceParts('Hi', [pastEnd])).toEqual([
      { type: 'text', text: 'Hi' },
      { type: 'workflow', reference: pastEnd }
    ])
  })
})
