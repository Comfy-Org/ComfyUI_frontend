import { describe, expect, it } from 'vitest'

import {
  planVariableSockets,
  renameVariableInTemplate
} from '@/platform/prompts/variableInputs'

describe('planVariableSockets', () => {
  it('adds a socket for a newly declared variable', () => {
    expect(planVariableSockets([], ['animal'])).toEqual({
      namesToAdd: ['animal'],
      indicesToRemove: []
    })
  })

  it('replaces an empty placeholder with the declared socket', () => {
    expect(
      planVariableSockets([{ name: '', connected: false }], ['animal'])
    ).toEqual({ namesToAdd: ['animal'], indicesToRemove: [0] })
  })

  it('keeps a socket that is still declared', () => {
    expect(
      planVariableSockets([{ name: 'animal', connected: false }], ['animal'])
    ).toEqual({ namesToAdd: [], indicesToRemove: [] })
  })

  it('keeps a connected socket whose declaration was removed', () => {
    expect(
      planVariableSockets([{ name: 'animal', connected: true }], [])
    ).toEqual({ namesToAdd: [], indicesToRemove: [] })
  })

  it('drops an undeclared, unconnected socket and adds the new one', () => {
    expect(
      planVariableSockets([{ name: 'old', connected: false }], ['new'])
    ).toEqual({ namesToAdd: ['new'], indicesToRemove: [0] })
  })

  it('handles a mix of connected, stale, and placeholder sockets', () => {
    const plan = planVariableSockets(
      [
        { name: 'gender', connected: true },
        { name: 'stale', connected: false },
        { name: '', connected: false }
      ],
      ['gender', 'color']
    )
    expect(plan).toEqual({ namesToAdd: ['color'], indicesToRemove: [1, 2] })
  })

  it('does not add a declared variable twice', () => {
    expect(planVariableSockets([], ['animal', 'animal'])).toEqual({
      namesToAdd: ['animal'],
      indicesToRemove: []
    })
  })
})

describe('renameVariableInTemplate', () => {
  it('renames every matching variable reference', () => {
    const template = renameVariableInTemplate(
      [
        { type: 'text', value: 'a ' },
        { type: 'var', name: 'animal' },
        { type: 'text', value: ' and a ' },
        { type: 'var', name: 'animal' }
      ],
      'animal',
      'creature'
    )
    expect(template).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'var', name: 'creature' },
      { type: 'text', value: ' and a ' },
      { type: 'var', name: 'creature' }
    ])
  })

  it('leaves other variables and asset references untouched', () => {
    const template = renameVariableInTemplate(
      [
        { type: 'var', name: 'color' },
        { type: 'asset', id: 'p1', name: 'animal' }
      ],
      'animal',
      'creature'
    )
    expect(template).toEqual([
      { type: 'var', name: 'color' },
      { type: 'asset', id: 'p1', name: 'animal' }
    ])
  })
})
