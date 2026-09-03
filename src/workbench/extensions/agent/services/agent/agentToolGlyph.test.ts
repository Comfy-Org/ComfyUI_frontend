import { describe, expect, it } from 'vitest'

import { knownTool, toolGlyph } from './agentToolGlyph'

describe('toolGlyph', () => {
  it.for([
    ['new_tab', 'icon-[lucide--plus]'],
    ['switch_tab', 'icon-[lucide--arrow-left-right]'],
    ['remember', 'icon-[lucide--save]'],
    ['forget', 'icon-[lucide--circle-question-mark]']
  ])('gives %s its dedicated icon', ([name, icon]) => {
    expect(toolGlyph(name, 'done', true)).toBe(icon)
  })

  it('falls back to a generic wrench for an unknown tool', () => {
    expect(toolGlyph('resize_image_node', 'done', true)).toBe(
      'icon-[lucide--wrench]'
    )
  })

  it('shows the failure glyph instead of the tool icon on a failed call', () => {
    expect(toolGlyph('new_tab', 'done', false)).toBe('icon-[lucide--circle-x]')
  })

  it('spins while the call streams', () => {
    expect(toolGlyph('new_tab', 'streaming')).toBe(
      'animate-spin icon-[lucide--loader-circle]'
    )
  })
})

describe('knownTool', () => {
  it('pairs every known tool with both a label key and an icon', () => {
    for (const name of ['new_tab', 'switch_tab', 'remember', 'forget']) {
      const tool = knownTool(name)
      expect(tool?.labelKey).toMatch(/^agent\./)
      expect(tool?.icon).toMatch(/^icon-\[lucide--/)
    }
  })

  it('does not resolve a tool name that collides with Object.prototype', () => {
    expect(knownTool('constructor')).toBeUndefined()
    expect(knownTool('toString')).toBeUndefined()
  })
})
