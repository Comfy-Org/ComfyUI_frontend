import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'

import { dynamicPromptsExtension as extension } from './dynamicPrompts'

function createPromptWidget(
  type: 'text' | 'number',
  value: string | number,
  dynamicPrompts: boolean
) {
  const node = new LGraphNode('CLIPTextEncode')
  const widget = node.addWidget(type, 'prompt', value, () => {})
  widget.dynamicPrompts = dynamicPrompts
  extension.nodeCreated?.(node, fromPartial<ComfyApp>({}))
  return widget
}

describe('Comfy.DynamicPrompts extension', () => {
  it('serializes a resolved prompt without changing the widget value', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const widget = createPromptWidget('text', '{cat|dog} photo', true)

    expect(widget.serializeValue?.(new LGraphNode('Host'), 0)).toBe('dog photo')
    expect(widget.value).toBe('{cat|dog} photo')
  })

  it('serializes non-string values unchanged', () => {
    const widget = createPromptWidget('number', 7, true)

    expect(widget.serializeValue?.(new LGraphNode('Host'), 0)).toBe(7)
  })

  it('leaves widgets without dynamic prompts alone', () => {
    const widget = createPromptWidget('text', '{cat|dog}', false)

    expect(widget.serializeValue).toBeUndefined()
  })
})
