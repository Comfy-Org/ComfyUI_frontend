// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopField } from './workshop-detail'
import {
  popWorkshopForm,
  safeReturnPath,
  stashWorkshopForm
} from './workshop-return'

describe('safeReturnPath', () => {
  it('passes a same-origin absolute path through', () => {
    expect(safeReturnPath('/workshop/models/flux/')).toBe(
      '/workshop/models/flux/'
    )
    expect(safeReturnPath('/workshop/?tab=api')).toBe('/workshop/?tab=api')
  })

  it.for([
    ['a protocol-relative URL', '//evil.com/workshop'],
    ['a backslash variant', '/\\evil.com'],
    ['an absolute URL', 'https://evil.com/workshop'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'workshop/models'],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined]
  ] as const)('falls back to the Workshop home for %s', ([, raw]) => {
    expect(safeReturnPath(raw)).toBe('/workshop/')
  })
})

const fields: readonly WorkshopField[] = [
  {
    kind: 'text',
    name: 'prompt',
    label: 'Prompt',
    required: true,
    multiline: true,
    valueType: 'string'
  },
  {
    kind: 'media',
    name: 'media_image',
    role: 'image',
    label: 'Image',
    required: false,
    multiple: false,
    accept: 'image'
  },
  {
    kind: 'toggle',
    name: 'hd',
    label: 'HD',
    required: false,
    defaultValue: false
  }
]

describe('stashWorkshopForm / popWorkshopForm', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('round-trips plain values and removes the stash after one pop', () => {
    stashWorkshopForm('flux', fields, { prompt: 'a cat', hd: true })

    expect(popWorkshopForm('flux', fields)).toEqual({
      prompt: 'a cat',
      hd: true
    })
    expect(
      popWorkshopForm('flux', fields),
      'the stash is one-shot'
    ).toBeUndefined()
  })

  it('never lets a media placeholder string survive the round trip', () => {
    stashWorkshopForm('flux', fields, {
      prompt: 'a cat',
      media_image: '<cat.png>'
    })

    expect(
      popWorkshopForm('flux', fields),
      "a restored '<cat.png>' would run as a literal input on exactly the image models"
    ).toEqual({ prompt: 'a cat' })
  })

  it('keeps stashes for different models apart', () => {
    stashWorkshopForm('flux', fields, { prompt: 'a cat' })
    stashWorkshopForm('kling', fields, { prompt: 'a dog' })

    expect(popWorkshopForm('flux', fields)).toEqual({ prompt: 'a cat' })
    expect(popWorkshopForm('kling', fields)).toEqual({ prompt: 'a dog' })
  })

  it('ignores corrupt or tampered stashes at the consume seam', () => {
    sessionStorage.setItem('comfy.workshop.form.flux', '{not json')
    expect(popWorkshopForm('flux', fields)).toBeUndefined()

    sessionStorage.setItem(
      'comfy.workshop.form.flux',
      JSON.stringify({
        prompt: { nested: 'object' },
        unknown_field: 'x',
        media_image: '<smuggled.png>'
      })
    )
    expect(
      popWorkshopForm('flux', fields),
      'sessionStorage is visitor-editable; only field-shaped values pass'
    ).toBeUndefined()
  })

  it('degrades to no stash when storage throws', () => {
    const spy = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(() =>
      stashWorkshopForm('flux', fields, { prompt: 'a cat' })
    ).not.toThrow()
    spy.mockRestore()
    expect(popWorkshopForm('flux', fields)).toBeUndefined()
  })
})
