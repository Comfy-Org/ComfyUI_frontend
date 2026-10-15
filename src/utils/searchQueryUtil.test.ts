import { describe, expect, it } from 'vitest'

import {
  buildPackSearchFallbacks,
  splitOnSeparators,
  stripRepoOwner
} from '@/utils/searchQueryUtil'

describe('splitOnSeparators', () => {
  it.for([
    { input: 'euler_discrete_scheduler', expected: 'euler discrete scheduler' },
    { input: 'euler-discrete-scheduler', expected: 'euler discrete scheduler' },
    {
      input: 'ComfyUI-Euler_DiscreteScheduler',
      expected: 'ComfyUI Euler DiscreteScheduler'
    },
    {
      input: 'comfyui-seedvr2_videoupscaler',
      expected: 'comfyui seedvr2 videoupscaler'
    },
    { input: 'qwen3-vl', expected: 'qwen3 vl' },
    { input: 'comfyui-47064894', expected: 'comfyui 47064894' },
    { input: 'euler  discrete', expected: 'euler discrete' },
    { input: '--euler-discrete--', expected: 'euler discrete' }
  ])('splits "$input" into "$expected"', ({ input, expected }) => {
    expect(splitOnSeparators(input)).toBe(expected)
  })

  it.for([
    'ComfyUI',
    'LoRA',
    'KSampler',
    'IPAdapter',
    'Hunyuan3D',
    'EulerDiscreteScheduler',
    'SDXL',
    'seedvr2',
    'hunyuan3d',
    'sd1.5',
    'minimax h3',
    'euler discrete scheduler',
    'scheduler',
    ''
  ])('leaves %j unchanged', (input) => {
    expect(splitOnSeparators(input)).toBe(input)
  })
})

describe('stripRepoOwner', () => {
  it.for([
    { query: 'kijai/comfyui-kjnodes', expected: 'comfyui-kjnodes' },
    { query: 'github.com/kijai/ComfyUI-KJNodes', expected: 'ComfyUI-KJNodes' },
    {
      query: 'https://github.com/kijai/ComfyUI-KJNodes',
      expected: 'ComfyUI-KJNodes'
    },
    {
      query: 'https://www.github.com/kijai/ComfyUI-KJNodes',
      expected: 'ComfyUI-KJNodes'
    },
    { query: 'GitHub.com/kijai/ComfyUI-KJNodes', expected: 'ComfyUI-KJNodes' },
    { query: 'github.com/kijai/kjnodes', expected: 'kjnodes' },
    ...[
      '?tab=readme-ov-file',
      '/tree/main',
      '/blob/main/nodes.py',
      '/issues/123',
      '/pulls',
      '.git',
      '/',
      '#readme'
    ].map((tail) => ({
      query: `https://github.com/kijai/ComfyUI-KJNodes${tail}`,
      expected: 'ComfyUI-KJNodes'
    })),
    {
      query: 'git@github.com:kijai/ComfyUI-KJNodes.git',
      expected: 'ComfyUI-KJNodes'
    },
    { query: 'kijai/ComfyUI-KJNodes', expected: 'ComfyUI-KJNodes' },
    { query: 'gaclove/comfyui.vfi', expected: 'comfyui.vfi' },
    {
      query: 'ainvfx/comfyui-seedvr2_videoupscaler',
      expected: 'comfyui-seedvr2_videoupscaler'
    }
  ])('strips "$query" to "$expected"', ({ query, expected }) => {
    expect(stripRepoOwner(query)).toBe(expected)
  })

  it.for([
    'comfyui-kjnodes',
    'image to video',
    'upscale / restore',
    '/leading-slash',
    'trailing-slash/',
    'SD1.5/SDXL',
    'image/upscaling',
    'SDXL/Flux',
    'upscale/restore',
    '1/2',
    'kijai/c',
    'kijai/comfyui-',
    'kijai/kjnodes',
    'owner/repo-name/tree/main',
    'github.com/kijai'
  ])('keeps %j unchanged', (query) => {
    expect(stripRepoOwner(query)).toBe(query)
  })
})

describe('buildPackSearchFallbacks', () => {
  it.for([
    {
      query: 'kijai/comfyui-KJNodes',
      expected: ['comfyui-KJNodes', 'comfyui KJNodes']
    },
    {
      query: 'https://github.com/kijai/ComfyUI-KJNodes',
      expected: ['ComfyUI-KJNodes', 'ComfyUI KJNodes']
    },
    {
      query: 'euler-discrete-scheduler',
      expected: ['euler discrete scheduler']
    },
    { query: 'github.com/kijai/kjnodes', expected: ['kjnodes'] }
  ])('yields $expected for "$query"', ({ query, expected }) => {
    expect(buildPackSearchFallbacks(query)).toEqual(expected)
  })

  it.for([
    'flux upscale',
    'seedvr2',
    'ComfyUI',
    'LoRA',
    'EulerDiscreteScheduler',
    'sd1.5',
    'image/upscaling',
    'kijai/c',
    '',
    '   ',
    'gguf '
  ])('yields nothing for %j', (query) => {
    expect(buildPackSearchFallbacks(query)).toEqual([])
  })
})
