import { beforeEach, describe, expect, it } from 'vitest'

import { lastList } from './hub-list-memory'

const KEY = 'comfy-hub-list'
const MODEL = '/hub/models/seedream-4-5/'

const remember = (value: unknown) =>
  sessionStorage.setItem(KEY, JSON.stringify(value))

beforeEach(() => {
  sessionStorage.clear()
})

describe('lastList', () => {
  it('returns the list a model was opened from, once', () => {
    remember({ href: '/hub/models/?q=video', label: 'Video', modelPath: MODEL })

    expect(lastList(MODEL)).toEqual({
      href: '/hub/models/?q=video',
      label: 'Video'
    })
    expect(lastList(MODEL)).toBeUndefined()
  })

  it('forgets a list remembered for another model page', () => {
    remember({ href: '/hub/models/', modelPath: '/hub/models/other/' })

    expect(lastList(MODEL)).toBeUndefined()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it.for([
    ['malformed JSON', '{not json'],
    [
      'a list on another site',
      JSON.stringify({ href: '//evil.com/', modelPath: MODEL })
    ],
    [
      'a backslash route to another site',
      JSON.stringify({ href: '/\\evil.com', modelPath: MODEL })
    ],
    [
      'an absolute address',
      JSON.stringify({ href: 'https://evil.com/', modelPath: MODEL })
    ],
    [
      'a label that is not text',
      JSON.stringify({ href: '/hub/models/', label: 3, modelPath: MODEL })
    ]
  ])('ignores %s', ([, stored]) => {
    sessionStorage.setItem(KEY, stored)

    expect(lastList(MODEL)).toBeUndefined()
  })
})
