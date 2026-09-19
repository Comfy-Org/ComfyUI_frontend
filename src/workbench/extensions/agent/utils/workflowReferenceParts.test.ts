import { describe, expect, it } from 'vitest'

import type { WorkflowReference } from '../types/workflowReference'
import { workflowReferenceParts } from './workflowReferenceParts'

describe('workflowReferenceParts', () => {
  it('returns no parts for empty text and no references', () => {
    expect(workflowReferenceParts('', [])).toEqual([])
  })

  it('returns the whole string as one text part when there are no references', () => {
    expect(workflowReferenceParts('  Use this\n', [])).toEqual([
      { type: 'text', text: '  Use this\n' }
    ])
  })

  it('keeps a lone leading reference and the remaining text', () => {
    const lighting: WorkflowReference = {
      id: 'a',
      name: 'Lighting',
      textOffset: 0
    }

    expect(workflowReferenceParts(' into the scene', [lighting])).toEqual([
      { type: 'workflow', reference: lighting },
      { type: 'text', text: ' into the scene' }
    ])
  })

  it('splits around a mid-string reference and keeps surrounding whitespace', () => {
    const lighting: WorkflowReference = {
      id: 'a',
      name: 'Lighting',
      textOffset: 5
    }

    expect(workflowReferenceParts('Copy  into .', [lighting])).toEqual([
      { type: 'text', text: 'Copy ' },
      { type: 'workflow', reference: lighting },
      { type: 'text', text: ' into .' }
    ])
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

  it('treats textOffset as a UTF-16 index and clamps past the string', () => {
    const afterEmoji: WorkflowReference = {
      id: 'a',
      name: 'A',
      textOffset: 2
    }
    const pastEnd: WorkflowReference = { id: 'b', name: 'B', textOffset: 99 }

    expect(workflowReferenceParts('😀x', [afterEmoji])).toEqual([
      { type: 'text', text: '😀' },
      { type: 'workflow', reference: afterEmoji },
      { type: 'text', text: 'x' }
    ])
    expect(workflowReferenceParts('Hi', [pastEnd])).toEqual([
      { type: 'text', text: 'Hi' },
      { type: 'workflow', reference: pastEnd }
    ])
  })

  it('still emits a reference when the prompt text is empty', () => {
    const lighting: WorkflowReference = {
      id: 'a',
      name: 'Lighting',
      textOffset: 0
    }

    expect(workflowReferenceParts('', [lighting])).toEqual([
      { type: 'workflow', reference: lighting }
    ])
  })
})
