import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IPasswordWidget } from '@/lib/litegraph/src/types/widgets'

import { PasswordWidget } from './PasswordWidget'

function createTestWidget(
  node: LGraphNode,
  overrides: Partial<IPasswordWidget> = {}
): PasswordWidget {
  return new PasswordWidget(
    {
      type: 'password',
      name: 'api_key',
      value: '',
      options: {},
      y: 0,
      ...overrides
    },
    node
  )
}

describe('PasswordWidget', () => {
  let node: LGraphNode

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    node = new LGraphNode('TestNode')
    node.id = 1
  })

  it('initializes with type "password"', () => {
    const widget = createTestWidget(node)
    expect(widget.type).toBe('password')
  })

  it('initializes with empty string value by default', () => {
    const widget = createTestWidget(node)
    expect(widget.value).toBe('')
  })

  it('accepts initial value', () => {
    const widget = createTestWidget(node, { value: 'sk-abc123' })
    expect(widget.value).toBe('sk-abc123')
  })

  describe('_displayValue masking', () => {
    it('returns masked characters for non-empty value', () => {
      const widget = createTestWidget(node, { value: 'sk-abc123' })
      expect(widget._displayValue).toBe('\u2022'.repeat(9))
    })

    it('returns empty string for empty value', () => {
      const widget = createTestWidget(node, { value: '' })
      expect(widget._displayValue).toBe('')
    })

    it('caps mask length at 20 characters', () => {
      const widget = createTestWidget(node, {
        value: 'a'.repeat(50)
      })
      expect(widget._displayValue).toBe('\u2022'.repeat(20))
    })

    it('returns empty string when disabled', () => {
      const widget = createTestWidget(node, { value: 'secret' })
      widget.computedDisabled = true
      expect(widget._displayValue).toBe('')
    })
  })
})
