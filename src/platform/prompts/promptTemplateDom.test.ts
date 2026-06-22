import { describe, expect, it } from 'vitest'

import {
  createChipElement,
  createTemplateFragment,
  parseElementToTemplate,
  renderTemplateToElement
} from '@/platform/prompts/promptTemplateDom'
import type { PromptTemplate } from '@/platform/prompts/schemas/promptTypes'

function host(): HTMLElement {
  return document.createElement('div')
}

describe('promptTemplateDom', () => {
  it('renders chips with type, id and name attributes', () => {
    const chip = createChipElement({ type: 'asset', id: 'p1', name: 'style' })
    expect(chip.getAttribute('data-chip-type')).toBe('asset')
    expect(chip.getAttribute('data-chip-id')).toBe('p1')
    expect(chip.getAttribute('data-chip-name')).toBe('style')
    expect(chip.textContent).toBe('@style')
    expect(chip.contentEditable).toBe('false')
  })

  it('round-trips text, asset and variable segments', () => {
    const template: PromptTemplate = [
      { type: 'text', value: 'a portrait in ' },
      { type: 'asset', id: 'p1', name: 'style' },
      { type: 'text', value: ', set in ' },
      { type: 'var', name: 'setting' }
    ]
    const el = host()
    renderTemplateToElement(el, template)
    expect(parseElementToTemplate(el)).toEqual(template)
  })

  it('merges adjacent text nodes', () => {
    const el = host()
    el.append(document.createTextNode('foo'))
    el.append(document.createTextNode('bar'))
    expect(parseElementToTemplate(el)).toEqual([
      { type: 'text', value: 'foobar' }
    ])
  })

  it('treats <br> elements as newlines', () => {
    const el = host()
    el.append(document.createTextNode('line1'))
    el.append(document.createElement('br'))
    el.append(document.createTextNode('line2'))
    expect(parseElementToTemplate(el)).toEqual([
      { type: 'text', value: 'line1\nline2' }
    ])
  })

  it('ignores empty text nodes', () => {
    const el = host()
    el.append(document.createTextNode(''))
    el.append(createChipElement({ type: 'var', name: 'x' }))
    expect(parseElementToTemplate(el)).toEqual([{ type: 'var', name: 'x' }])
  })

  it('builds a fragment of text nodes and chips for expansion', () => {
    const template: PromptTemplate = [
      { type: 'text', value: 'hi ' },
      { type: 'asset', id: 'p1', name: 'style' }
    ]
    const el = host()
    el.append(createTemplateFragment(template))
    expect(parseElementToTemplate(el)).toEqual(template)
  })
})
