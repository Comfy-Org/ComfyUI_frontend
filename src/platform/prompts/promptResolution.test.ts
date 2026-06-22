import { describe, expect, it, vi } from 'vitest'

import { resolvePromptTemplate } from '@/platform/prompts/promptResolution'
import type { PromptTemplate } from '@/platform/prompts/schemas/promptTypes'

const noVars = (name: string) => `<${name}>`

describe('resolvePromptTemplate', () => {
  it('concatenates text segments', () => {
    const template: PromptTemplate = [
      { type: 'text', value: 'hello ' },
      { type: 'text', value: 'world' }
    ]
    expect(
      resolvePromptTemplate(template, {
        getPromptTemplate: () => undefined,
        resolveVar: noVars
      })
    ).toBe('hello world')
  })

  it('expands a stored prompt reference recursively', () => {
    const templates: Record<string, PromptTemplate> = {
      outer: [
        { type: 'text', value: 'a ' },
        { type: 'asset', id: 'inner', name: 'inner' },
        { type: 'text', value: ' c' }
      ],
      inner: [{ type: 'text', value: 'b' }]
    }
    const result = resolvePromptTemplate(templates.outer, {
      getPromptTemplate: (id) => templates[id],
      resolveVar: noVars
    })
    expect(result).toBe('a b c')
  })

  it('resolves a missing reference to an empty string', () => {
    const template: PromptTemplate = [
      { type: 'text', value: 'x' },
      { type: 'asset', id: 'gone', name: 'gone' }
    ]
    expect(
      resolvePromptTemplate(template, {
        getPromptTemplate: () => undefined,
        resolveVar: noVars
      })
    ).toBe('x')
  })

  it('breaks self-referential cycles without infinite recursion', () => {
    const selfTemplate: PromptTemplate = [
      { type: 'text', value: 'loop ' },
      { type: 'asset', id: 'self', name: 'self' }
    ]
    const getPromptTemplate = vi.fn((id: string) =>
      id === 'self' ? selfTemplate : undefined
    )
    const result = resolvePromptTemplate(selfTemplate, {
      getPromptTemplate,
      resolveVar: noVars
    })
    expect(result).toBe('loop loop ')
    // outer pass + one expansion before the cycle guard stops recursion
    expect(getPromptTemplate).toHaveBeenCalledTimes(1)
  })

  it('breaks mutual cycles between two prompts', () => {
    const templates: Record<string, PromptTemplate> = {
      a: [
        { type: 'text', value: 'A' },
        { type: 'asset', id: 'b', name: 'b' }
      ],
      b: [
        { type: 'text', value: 'B' },
        { type: 'asset', id: 'a', name: 'a' }
      ]
    }
    const result = resolvePromptTemplate(templates.a, {
      getPromptTemplate: (id) => templates[id],
      resolveVar: noVars
    })
    // a expands b, b expands a once more, then the repeat of b is cut: bounded.
    expect(result).toBe('ABA')
  })

  it('delegates variable segments to resolveVar', () => {
    const template: PromptTemplate = [
      { type: 'text', value: 'style: ' },
      { type: 'var', name: 'art_style' }
    ]
    expect(
      resolvePromptTemplate(template, {
        getPromptTemplate: () => undefined,
        resolveVar: (name) => (name === 'art_style' ? 'anime' : '')
      })
    ).toBe('style: anime')
  })
})
