import { describe, expect, it } from 'vitest'

import { tokenizeCompoundWords } from '@/utils/compoundWordUtil'

describe('tokenizeCompoundWords', () => {
  it('splits camelCase transitions', () => {
    expect(tokenizeCompoundWords('eulerDiscreteScheduler')).toBe(
      'euler Discrete Scheduler'
    )
  })

  it('splits PascalCase transitions', () => {
    expect(tokenizeCompoundWords('EulerDiscreteScheduler')).toBe(
      'Euler Discrete Scheduler'
    )
  })

  it('splits snake_case on underscores', () => {
    expect(tokenizeCompoundWords('euler_discrete_scheduler')).toBe(
      'euler discrete scheduler'
    )
  })

  it('splits kebab-case on hyphens', () => {
    expect(tokenizeCompoundWords('euler-discrete-scheduler')).toBe(
      'euler discrete scheduler'
    )
  })

  it('splits input with mixed separators and casing', () => {
    expect(tokenizeCompoundWords('ComfyUI-Euler_DiscreteScheduler')).toBe(
      'Comfy UI Euler Discrete Scheduler'
    )
  })

  it('keeps a trailing all-caps acronym run intact', () => {
    expect(tokenizeCompoundWords('SDXL')).toBe('SDXL')
  })

  it('splits an acronym run from a following capitalized word', () => {
    expect(tokenizeCompoundWords('ComfyUI')).toBe('Comfy UI')
    expect(tokenizeCompoundWords('XMLHttpRequest')).toBe('XML Http Request')
  })

  it('splits a letter run from a following digit run', () => {
    expect(tokenizeCompoundWords('SD3')).toBe('SD 3')
  })

  it('splits a digit run from a following letter run', () => {
    expect(tokenizeCompoundWords('v2Turbo')).toBe('v 2 Turbo')
  })

  it('is a no-op on already space-separated input', () => {
    expect(tokenizeCompoundWords('euler discrete scheduler')).toBe(
      'euler discrete scheduler'
    )
  })

  it('returns an empty string for empty input', () => {
    expect(tokenizeCompoundWords('')).toBe('')
  })

  it('returns a single word unchanged', () => {
    expect(tokenizeCompoundWords('scheduler')).toBe('scheduler')
  })

  it('trims leading and trailing separators', () => {
    expect(tokenizeCompoundWords('--euler-discrete--')).toBe('euler discrete')
  })
})
