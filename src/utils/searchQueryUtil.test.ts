import { describe, expect, it } from 'vitest'

import {
  buildPackSearchFallbacks,
  splitOnSeparators,
  toRepoName
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

describe('toRepoName', () => {
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
    { query: 'kijai/comfyui-kjnodes.git', expected: 'comfyui-kjnodes' },
    { query: 'kijai/ComfyUI-KJNodes.GIT', expected: 'ComfyUI-KJNodes' },
    { query: 'kijai/comfyui-kjnodes/', expected: 'comfyui-kjnodes' },
    { query: 'kijai/comfyui-kjnodes//', expected: 'comfyui-kjnodes' },
    { query: 'kijai/comfyui-kjnodes.git/', expected: 'comfyui-kjnodes' },
    { query: 'kijai/comfyui-kjnodes.git//', expected: 'comfyui-kjnodes' },
    { query: 'kijai/comfyui-kjnodes /', expected: 'comfyui-kjnodes' },
    { query: 'kijai/comfyui-kjnodes / /', expected: 'comfyui-kjnodes' },
    {
      query: 'ltdrdata/ComfyUI-Manager.git /',
      expected: 'ComfyUI-Manager'
    },
    { query: 'Comfy-Org/ComfyUI-Manager', expected: 'ComfyUI-Manager' },
    { query: 'ZHO-ZHO-ZHO/ComfyUI-Gemini', expected: 'ComfyUI-Gemini' },
    {
      query: 'ainvfx/comfyui-seedvr2_videoupscaler',
      expected: 'comfyui-seedvr2_videoupscaler'
    }
  ])('strips "$query" to "$expected"', ({ query, expected }) => {
    expect(toRepoName(query)).toBe(expected)
  })

  it('strips the tail after a long run of inner spaces', () => {
    const spaces = ' '.repeat(50_000)

    expect(toRepoName(`a${spaces}b /`)).toBe(`a${spaces}b`)
  })

  it(
    'strips the owner from a long pasted compound slug in linear time',
    { timeout: 250 },
    () => {
      const slug = 'a-a'.repeat(50_000)

      expect(toRepoName(`a/${slug}`)).toBe(slug)
      expect(toRepoName(`a/${slug}!`)).toBe(`a/${slug}!`)
    }
  )

  it.for([
    { query: 'ComfyUI-KJNodes.git', expected: 'ComfyUI-KJNodes' },
    { query: 'ComfyUI-KJNodes.GIT', expected: 'ComfyUI-KJNodes' },
    { query: 'comfyui-kjnodes/', expected: 'comfyui-kjnodes' },
    { query: ' comfyui-kjnodes.git// ', expected: 'comfyui-kjnodes' },
    { query: 'trailing-slash/', expected: 'trailing-slash' },
    { query: 'kijai/kjnodes/', expected: 'kijai/kjnodes' },
    { query: 'image/upscaling/', expected: 'image/upscaling' }
  ])(
    'drops only the suffix from "$query" to "$expected"',
    ({ query, expected }) => {
      expect(toRepoName(query)).toBe(expected)
    }
  )

  it.for([
    'comfyui-kjnodes',
    'github',
    'image to video',
    'upscale / restore',
    '/leading-slash',
    'SD1.5/SDXL',
    'sdxl/sd1.5',
    'sd1.5/comfyui-x',
    'gaclove/comfyui.vfi',
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
    expect(toRepoName(query)).toBe(query)
  })
})

describe('buildPackSearchFallbacks', () => {
  it.for([
    {
      query: 'ComfyUI-KJNodes.git',
      expected: ['ComfyUI-KJNodes', 'ComfyUI KJNodes']
    },
    {
      query: 'kijai/comfyui-KJNodes//',
      expected: ['comfyui-KJNodes', 'comfyui KJNodes']
    },
    {
      query: 'kijai/comfyui-KJNodes',
      expected: ['comfyui-KJNodes', 'comfyui KJNodes']
    },
    {
      query: 'kijai/comfyui-KJNodes/',
      expected: ['comfyui-KJNodes', 'comfyui KJNodes']
    },
    {
      query: 'https://github.com/kijai/ComfyUI-KJNodes',
      expected: ['ComfyUI-KJNodes', 'ComfyUI KJNodes']
    },
    {
      query: 'kijai/comfyui-kjnodes /',
      expected: ['comfyui-kjnodes', 'comfyui kjnodes']
    },
    {
      query: 'kijai/comfyui-kjnodes / /',
      expected: ['comfyui-kjnodes', 'comfyui kjnodes']
    },
    { query: 'comfyui-kjnodes /', expected: ['comfyui kjnodes'] },
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
    'image/upscaling/',
    'image/upscaling//',
    'image/upscaling / /',
    'https://github.com/kijai/',
    'kijai/kjnodes/',
    'kijai/c',
    '',
    '   ',
    'gguf ',
    'euler  discrete',
    ' euler \t discrete '
  ])('yields nothing for %j', (query) => {
    expect(buildPackSearchFallbacks(query)).toEqual([])
  })

  it('yields nothing for a long run of inner spaces', () => {
    expect(buildPackSearchFallbacks(`a${' '.repeat(50_000)}b /`)).toEqual([])
  })
})
