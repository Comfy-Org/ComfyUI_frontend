import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import { toolGlyph, toolLabel } from './agentToolGlyph'

const asKey = (key: string) => key

describe('toolGlyph', () => {
  it.for([
    ['new_tab', 'icon-[lucide--plus]'],
    ['switch_tab', 'icon-[lucide--arrow-left-right]'],
    ['remember', 'icon-[lucide--save]'],
    ['forget', 'icon-[lucide--circle-question-mark]'],
    ['set_extension_enabled', 'icon-[lucide--package]'],
    ['remove_extension', 'icon-[lucide--package-minus]']
  ])('gives %s its dedicated icon', ([name, icon]) => {
    expect(toolGlyph(name, 'done', { ok: true })).toBe(icon)
  })

  it('falls back to a generic wrench for an unknown tool', () => {
    expect(toolGlyph('resize_image_node', 'done', { ok: true })).toBe(
      'icon-[lucide--wrench]'
    )
  })

  it('shows the failure glyph instead of the tool icon on a failed call', () => {
    expect(toolGlyph('new_tab', 'done', { ok: false })).toBe(
      'icon-[lucide--circle-x]'
    )
  })

  it('spins while the call streams', () => {
    expect(toolGlyph('new_tab', 'streaming')).toBe(
      'animate-spin icon-[lucide--loader-circle]'
    )
  })
})

describe('toolLabel', () => {
  it.for([
    'new_tab',
    'switch_tab',
    'remember',
    'forget',
    'set_extension_enabled',
    'remove_extension'
  ])('gives %s a key for both the running and the finished state', (name) => {
    expect(toolLabel(name, 'streaming', asKey)).toMatch(/^agent\./)
    expect(toolLabel(name, 'done', asKey)).toMatch(/^agent\./)
    expect(toolLabel(name, 'streaming', asKey)).not.toBe(
      toolLabel(name, 'done', asKey)
    )
  })

  it('humanizes an unknown tool name', () => {
    expect(toolLabel('resize_image_node', 'done', asKey)).toBe(
      'Resize image node'
    )
  })

  it('does not resolve a tool name that collides with Object.prototype', () => {
    expect(toolLabel('constructor', 'done', asKey)).toBe('Constructor')
    expect(toolGlyph('constructor', 'done', { ok: true })).toBe(
      'icon-[lucide--wrench]'
    )
  })
})

describe('node pack tool labels', () => {
  const translate = (key: string) => i18n.global.t(key)

  it.for([
    ['set_extension_enabled', 'Switching a node pack', 'Switched a node pack'],
    ['remove_extension', 'Removing a node pack', 'Removed a node pack']
  ])('reads %s as "%s" then "%s"', ([name, running, done]) => {
    expect(toolLabel(name, 'streaming', translate)).toBe(running)
    expect(toolLabel(name, 'done', translate)).toBe(done)
  })
})
