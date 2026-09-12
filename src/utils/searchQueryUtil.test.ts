import { describe, expect, it } from 'vitest'

import {
  buildPackSearchFallbacks,
  stripRepoOwner,
  tokenizeCompoundWords
} from '@/utils/searchQueryUtil'

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

  it('keeps a version-bearing model name whole', () => {
    expect(tokenizeCompoundWords('seedvr2')).toBe('seedvr2')
    expect(tokenizeCompoundWords('qwen3')).toBe('qwen3')
    expect(tokenizeCompoundWords('automatic1111')).toBe('automatic1111')
  })

  it('keeps a lowercase suffix attached to its version digits', () => {
    expect(tokenizeCompoundWords('hunyuan3d')).toBe('hunyuan3d')
    expect(tokenizeCompoundWords('minimax h3')).toBe('minimax h3')
  })

  it('splits a capitalized word following a digit run', () => {
    expect(tokenizeCompoundWords('v2Turbo')).toBe('v2 Turbo')
  })

  it('splits an alphanumeric run that a separator already broke up', () => {
    expect(tokenizeCompoundWords('qwen3-vl')).toBe('qwen3 vl')
    expect(tokenizeCompoundWords('comfyui-47064894')).toBe('comfyui 47064894')
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

describe('stripRepoOwner', () => {
  it('drops the owner segment of a repo slug', () => {
    expect(stripRepoOwner('kijai/comfyui-kjnodes')).toBe('comfyui-kjnodes')
  })

  it('keeps a slug that has no owner segment', () => {
    expect(stripRepoOwner('comfyui-kjnodes')).toBe('comfyui-kjnodes')
  })

  it('drops only the first segment of a deeper path', () => {
    expect(stripRepoOwner('owner/repo/tree/main')).toBe('repo/tree/main')
  })

  it('keeps a query whose slash is not an owner boundary', () => {
    expect(stripRepoOwner('image to video')).toBe('image to video')
    expect(stripRepoOwner('upscale / restore')).toBe('upscale / restore')
    expect(stripRepoOwner('/leading-slash')).toBe('/leading-slash')
    expect(stripRepoOwner('trailing-slash/')).toBe('trailing-slash/')
  })
})

describe('buildPackSearchFallbacks', () => {
  it('yields the owner-stripped slug and its tokenized form', () => {
    expect(buildPackSearchFallbacks('kijai/comfyui-KJNodes')).toEqual([
      'comfyui-KJNodes',
      'comfyui KJ Nodes'
    ])
  })

  it('yields only the tokenized form when there is no owner segment', () => {
    expect(buildPackSearchFallbacks('EulerDiscreteScheduler')).toEqual([
      'Euler Discrete Scheduler'
    ])
  })

  it('yields nothing for a query that needs no rewriting', () => {
    expect(buildPackSearchFallbacks('flux upscale')).toEqual([])
    expect(buildPackSearchFallbacks('seedvr2')).toEqual([])
    expect(buildPackSearchFallbacks('')).toEqual([])
  })

  it('does not repeat a candidate that both rewrites agree on', () => {
    expect(buildPackSearchFallbacks('kijai/kjnodes')).toEqual(['kjnodes'])
  })
})
