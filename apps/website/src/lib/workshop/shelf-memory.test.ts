import { afterEach, describe, expect, it, vi } from 'vitest'

import { lastList, rememberList, rememberListOnClick } from './shelf-memory'

const videos = { href: '/hub/models/?tab=video', label: 'Video models' }

afterEach(() => {
  sessionStorage.clear()
})

describe('list memory', () => {
  it('reads back the list the visitor was standing on', () => {
    rememberList(videos, '/models/kling/')
    expect(lastList('/models/kling/')).toEqual(videos)
  })

  it('reads back a list without a name of its own', () => {
    rememberList({ href: '/hub/models/' }, '/models/kling/')
    expect(lastList('/models/kling/')).toEqual({ href: '/hub/models/' })
  })

  it.for([
    { named: 'a plain click', event: {}, remembered: videos },
    { named: 'a middle click', event: { button: 1 }, remembered: undefined },
    {
      named: 'a new-tab click',
      event: { metaKey: true },
      remembered: undefined
    },
    {
      named: 'a control click',
      event: { ctrlKey: true },
      remembered: undefined
    },
    {
      named: 'a new-window click',
      event: { shiftKey: true },
      remembered: undefined
    },
    {
      named: 'a download click',
      event: { altKey: true },
      remembered: undefined
    }
  ])('follows the model on $named', ({ event, remembered }) => {
    rememberListOnClick(
      videos,
      '/models/kling/',
      new MouseEvent('click', event)
    )
    expect(lastList('/models/kling/')).toEqual(remembered)
  })

  it('remembers nothing before the catalogue has been browsed', () => {
    expect(lastList('/models/kling/')).toBeUndefined()
  })

  it.for([
    { named: 'an old shelf', stored: 'retired-category' },
    {
      named: 'another site',
      stored: JSON.stringify({
        href: '//example.com/',
        modelPath: '/models/kling/'
      })
    },
    {
      named: 'a label that is not text',
      stored: JSON.stringify({
        href: '/hub/',
        label: 3,
        modelPath: '/models/kling/'
      })
    }
  ])('ignores $named', ({ stored }) => {
    sessionStorage.setItem('comfy-models-shelf', stored)
    expect(lastList('/models/kling/')).toBeUndefined()
  })

  it('does not apply a list to another model or a later visit', () => {
    rememberList(videos, '/models/kling/')
    expect(lastList('/models/flux/')).toBeUndefined()
    expect(lastList('/models/kling/')).toBeUndefined()
  })

  it('browses on when the browser refuses its own storage', () => {
    const denied = vi
      .spyOn(window, 'sessionStorage', 'get')
      .mockImplementation(() => {
        throw new Error('access to storage is denied')
      })

    try {
      expect(() => rememberList(videos, '/models/kling/')).not.toThrow()
      expect(lastList('/models/kling/')).toBeUndefined()
    } finally {
      denied.mockRestore()
    }
  })
})
