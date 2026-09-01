import { describe, expect, it } from 'vitest'

import type { McpDemoPrompt } from './mcpDemoPrompts'
import { mcpDemoPrompts, thumbUrls, visibleWindow } from './mcpDemoPrompts'

describe('visibleWindow', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f']

  it('returns the newest item first, counting backwards', () => {
    expect(visibleWindow(items, 4, 3)).toEqual(['e', 'd', 'c'])
  })

  it('wraps past the start of the list', () => {
    expect(visibleWindow(items, 1, 4)).toEqual(['b', 'a', 'f', 'e'])
  })

  it('stays full at every index so the rendered count never changes', () => {
    for (let index = 0; index < items.length; index++) {
      expect(visibleWindow(items, index, 4)).toHaveLength(4)
    }
  })

  it('never asks for more items than exist', () => {
    expect(visibleWindow(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})

describe('thumbUrls', () => {
  const prompt = (extra: Partial<McpDemoPrompt> = {}): McpDemoPrompt => ({
    id: 'set-extension',
    promptKey: 'mcp.hero.demoPromptSetExtension',
    toolKey: 'mcp.hero.demoToolSetExtension',
    result: 'set_extension.png',
    ...extra
  })

  it('derives a single thumbnail from the prompt id', () => {
    expect(thumbUrls(prompt())).toEqual([
      'https://media.comfy.org/website/mcp/hero-demo/set-extension.webp'
    ])
  })

  it('numbers the thumbnails of a variant prompt from one', () => {
    expect(thumbUrls(prompt({ variants: 3 }))).toEqual([
      'https://media.comfy.org/website/mcp/hero-demo/set-extension-1.webp',
      'https://media.comfy.org/website/mcp/hero-demo/set-extension-2.webp',
      'https://media.comfy.org/website/mcp/hero-demo/set-extension-3.webp'
    ])
  })
})

describe('mcpDemoPrompts', () => {
  it('has enough prompts to fill the visible window without repeats', () => {
    const window = visibleWindow(mcpDemoPrompts, 0, 5)

    expect(new Set(window.map((p) => p.id)).size).toBe(5)
  })
})
