import { describe, expect, it } from 'vitest'

import type { PromptTemplate } from '@/platform/prompts/promptTemplate'
import {
  autoSocketName,
  planVariableSockets,
  renameVariableInTemplate,
  resolvePromptTemplate
} from '@/platform/prompts/promptTemplate'

describe('resolvePromptTemplate', () => {
  it('concatenates text segments', () => {
    const template: PromptTemplate = [
      { type: 'text', value: 'hello ' },
      { type: 'text', value: 'world' }
    ]
    expect(resolvePromptTemplate(template, () => '')).toBe('hello world')
  })

  it('delegates variable segments to resolveVar', () => {
    const template: PromptTemplate = [
      { type: 'text', value: 'style: ' },
      { type: 'var', name: 'art_style' }
    ]
    expect(
      resolvePromptTemplate(template, (name) =>
        name === 'art_style' ? 'anime' : ''
      )
    ).toBe('style: anime')
  })
})

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

  it('drops a stale placeholder when a connected socket claims its name', () => {
    expect(
      planVariableSockets(
        [
          { name: 'subject', connected: false },
          { name: 'subject', connected: true }
        ],
        ['subject']
      )
    ).toEqual({ namesToAdd: [], indicesToRemove: [0] })
  })
})

describe('autoSocketName', () => {
  it('adopts a declared variable matching the title case-insensitively', () => {
    const name = autoSocketName(
      'Subject',
      ['subject'],
      [
        { name: 'subject', connected: false },
        { name: '', connected: true }
      ]
    )
    expect(name).toBe('subject')
  })

  it('does not adopt a variable another connected socket claims', () => {
    const name = autoSocketName(
      'Subject',
      ['subject'],
      [
        { name: 'subject', connected: true },
        { name: '', connected: true }
      ]
    )
    expect(name).toBe('Subject')
  })

  it('falls back to the source title when nothing matches', () => {
    expect(autoSocketName('Camera', ['subject'], [])).toBe('Camera')
  })

  it('suffixes a title already taken by another socket', () => {
    expect(
      autoSocketName('Camera', [], [{ name: 'Camera', connected: true }])
    ).toBe('Camera 2')
  })

  it('defaults to var for a blank title', () => {
    expect(autoSocketName('  ', [], [])).toBe('var')
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

  it('leaves other variables and text untouched', () => {
    const template = renameVariableInTemplate(
      [
        { type: 'var', name: 'color' },
        { type: 'text', value: 'animal' }
      ],
      'animal',
      'creature'
    )
    expect(template).toEqual([
      { type: 'var', name: 'color' },
      { type: 'text', value: 'animal' }
    ])
  })
})
