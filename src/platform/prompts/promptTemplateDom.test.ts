import { describe, expect, it } from 'vitest'

import {
  createChipElement,
  parseElementToTemplate,
  renderTemplateToElement
} from '@/platform/prompts/promptTemplateDom'
import type { PromptTemplate } from '@/platform/prompts/promptTypes'

function host(): HTMLElement {
  return document.createElement('div')
}

describe('promptTemplateDom', () => {
  it('renders chips with type and name attributes', () => {
    const chip = createChipElement('setting')
    expect(chip.getAttribute('data-chip-type')).toBe('var')
    expect(chip.getAttribute('data-chip-name')).toBe('setting')
    expect(chip.textContent).toBe('@setting')
    expect(chip.contentEditable).toBe('false')
  })

  it('round-trips text and variable segments', () => {
    const template: PromptTemplate = [
      { type: 'text', value: 'a portrait of ' },
      { type: 'var', name: 'subject' },
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
    el.append(createChipElement('x'))
    expect(parseElementToTemplate(el)).toEqual([{ type: 'var', name: 'x' }])
  })
})
