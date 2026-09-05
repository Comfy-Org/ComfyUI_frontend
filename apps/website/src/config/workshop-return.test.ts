// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopField } from './workshop-detail'
import {
  popWorkshopForm,
  requestedReturnPath,
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
    ['undefined', undefined],
    ['a tab after the leading slash', '/\t/evil.com'],
    ['a newline after the leading slash', '/\n/evil.com'],
    ['a carriage return after the leading slash', '/\r/evil.com'],
    ['a tab-hidden backslash', '/\t\\evil.com']
  ] as const)('falls back to the Workshop home for %s', ([, raw]) => {
    expect(
      safeReturnPath(raw),
      'the browser strips C0 control chars before parsing, so /<TAB>//evil.com resolves cross-origin'
    ).toBe('/workshop/')
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
  },
  {
    kind: 'number',
    name: 'steps',
    label: 'Steps',
    required: false,
    integer: true,
    step: 1,
    defaultValue: 20
  },
  {
    kind: 'select',
    name: 'quality',
    label: 'Quality',
    required: false,
    options: ['draft', 'high'],
    defaultValue: 'high'
  }
]

describe('stashWorkshopForm / popWorkshopForm', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('round-trips string, number and boolean values and removes the stash after one pop', () => {
    stashWorkshopForm('flux', fields, { prompt: 'a cat', steps: 30, hd: true })

    expect(popWorkshopForm('flux', fields)).toEqual({
      prompt: 'a cat',
      steps: 30,
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

  it('preserves a deliberately cleared optional field', () => {
    stashWorkshopForm('flux', fields, { prompt: 'a cat', steps: undefined })

    expect(popWorkshopForm('flux', fields)).toEqual({
      prompt: 'a cat',
      steps: undefined
    })
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

  it('rejects values that no longer match their field kind or options', () => {
    sessionStorage.setItem(
      'comfy.workshop.form.flux',
      JSON.stringify({
        prompt: 7,
        steps: '30',
        hd: 'yes',
        quality: 'retired-option'
      })
    )

    expect(popWorkshopForm('flux', fields)).toBeUndefined()
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

describe('requestedReturnPath', () => {
  it('does not invent a redirect for a direct visit to sign-in', () => {
    expect(requestedReturnPath('')).toBeUndefined()
    expect(requestedReturnPath('?returnTo=')).toBeUndefined()
  })

  it('accepts a safe explicit destination and contains an unsafe one', () => {
    expect(
      requestedReturnPath('?returnTo=%2Fworkshop%2Fmodels%2Fflux%2F')
    ).toBe('/workshop/models/flux/')
    expect(requestedReturnPath('?returnTo=https%3A%2F%2Fevil.com')).toBe(
      '/workshop/'
    )
  })
})
