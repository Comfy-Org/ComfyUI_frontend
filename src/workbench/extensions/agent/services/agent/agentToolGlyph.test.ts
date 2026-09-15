import { describe, expect, it } from 'vitest'

import { toolGlyph, toolLabel } from './agentToolGlyph'

const asKey = (key: string) => key

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

describe('toolLabel', () => {
  it.for(['new_tab', 'switch_tab', 'remember', 'forget'])(
    'gives %s a key for both the running and the finished state',
    (name) => {
      expect(toolLabel(name, 'streaming', asKey)).toMatch(/^agent\./)
      expect(toolLabel(name, 'done', asKey)).toMatch(/^agent\./)
      expect(toolLabel(name, 'streaming', asKey)).not.toBe(
        toolLabel(name, 'done', asKey)
      )
    }
  )

  it('humanizes an unknown tool name', () => {
    expect(toolLabel('resize_image_node', 'done', asKey)).toBe(
      'Resize image node'
    )
  })

  it('does not resolve a tool name that collides with Object.prototype', () => {
    expect(toolLabel('constructor', 'done', asKey)).toBe('Constructor')
    expect(toolGlyph('constructor', 'done', true)).toBe('icon-[lucide--wrench]')
  })
})
