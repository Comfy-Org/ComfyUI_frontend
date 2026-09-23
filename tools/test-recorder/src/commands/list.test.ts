import { describe, expect, it } from 'vitest'
import { filterWorkflows } from './list'

describe('filterWorkflows', () => {
  const workflows = [
    'default',
    'image/Load Image',
    'audio/Load Audio',
    'image/Upscale Image'
  ]

  it('matches workflow paths case-insensitively', () => {
    expect(filterWorkflows(workflows, 'IMAGE')).toEqual([
      'image/Load Image',
      'image/Upscale Image'
    ])
  })

  it('matches substrings anywhere in the workflow path', () => {
    expect(filterWorkflows(workflows, 'load')).toEqual([
      'image/Load Image',
      'audio/Load Audio'
    ])
  })

  it('returns all workflows for an empty keyword', () => {
    expect(filterWorkflows(workflows, '')).toEqual(workflows)
  })
})
