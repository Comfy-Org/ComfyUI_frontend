import { describe, expect, it } from 'vitest'

import {
  buildMissingNodeHint,
  createMissingNodeTypeFromError
} from './missingNodeErrorUtil'

describe('buildMissingNodeHint', () => {
  it('returns hint with title and node ID when both available', () => {
    expect(buildMissingNodeHint('My Node', 'MyNodeClass', '42')).toBe(
      '"My Node" (Node ID #42)'
    )
  })

  it('returns hint with title only when no node ID', () => {
    expect(buildMissingNodeHint('My Node', 'MyNodeClass', undefined)).toBe(
      '"My Node"'
    )
  })

  it('returns hint with node ID only when title matches class type', () => {
    expect(buildMissingNodeHint('MyNodeClass', 'MyNodeClass', '42')).toBe(
      'Node ID #42'
    )
  })

  it('returns undefined when title matches class type and no node ID', () => {
    expect(
      buildMissingNodeHint('MyNodeClass', 'MyNodeClass', undefined)
    ).toBeUndefined()
  })

  it('returns undefined when title is null and no node ID', () => {
    expect(buildMissingNodeHint(null, 'MyNodeClass', undefined)).toBeUndefined()
  })

  it('returns node ID hint when title is null but node ID exists', () => {
    expect(buildMissingNodeHint(null, 'MyNodeClass', '42')).toBe('Node ID #42')
  })
})

describe('createMissingNodeTypeFromError', () => {
  it('returns string type when no hint is generated', () => {
    const result = createMissingNodeTypeFromError({
      class_type: 'MyNodeClass',
      node_title: 'MyNodeClass'
    })
    expect(result).toBe('MyNodeClass')
  })

  it('returns object with hint when title differs from class type', () => {
    const result = createMissingNodeTypeFromError({
      class_type: 'MyNodeClass',
      node_title: 'My Custom Title',
      node_id: '42'
    })
    expect(result).toEqual({
      type: 'MyNodeClass',
      hint: '"My Custom Title" (Node ID #42)'
    })
  })

  it('handles null class_type by defaulting to Unknown', () => {
    const result = createMissingNodeTypeFromError({
      class_type: null,
      node_title: 'Some Title',
      node_id: '42'
    })
    expect(result).toEqual({
      type: 'Unknown',
      hint: '"Some Title" (Node ID #42)'
    })
  })

  it('handles empty extra_info', () => {
    const result = createMissingNodeTypeFromError({})
    expect(result).toBe('Unknown')
  })

  it('returns object with node ID hint when only node_id is available', () => {
    const result = createMissingNodeTypeFromError({
      class_type: 'MyNodeClass',
      node_id: '123'
    })
    expect(result).toEqual({
      type: 'MyNodeClass',
      hint: 'Node ID #123'
    })
  })
})
