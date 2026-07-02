import { describe, expect, it, vi } from 'vitest'

import { resolvePromptTemplate } from '@/platform/prompts/promptResolution'
import type { PromptTemplate } from '@/platform/prompts/promptTypes'

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

  it('passes the visit path through to resolveVar for cycle detection', () => {
    const template: PromptTemplate = [{ type: 'var', name: 'x' }]
    const visited: ReadonlySet<string> = new Set(['node:1'])
    const resolveVar = vi.fn(() => '')

    resolvePromptTemplate(template, resolveVar, visited)

    expect(resolveVar).toHaveBeenCalledWith('x', visited)
  })
})
