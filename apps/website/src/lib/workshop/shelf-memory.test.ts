import { afterEach, describe, expect, it, vi } from 'vitest'

import { lastShelf, rememberShelf } from './shelf-memory'

afterEach(() => {
  sessionStorage.clear()
})

describe('shelf memory', () => {
  it('reads back the shelf the visitor was standing on', () => {
    rememberShelf('generate-videos', '/models/kling/')
    expect(lastShelf('/models/kling/')).toBe('generate-videos')
  })

  it('remembers nothing before the catalogue has been browsed', () => {
    expect(lastShelf('/models/kling/')).toBeUndefined()
  })

  it('ignores a value that is no longer a shelf', () => {
    sessionStorage.setItem('comfy-models-shelf', 'retired-category')
    expect(lastShelf('/models/kling/')).toBeUndefined()
  })

  it('does not apply a shelf to another model or a later visit', () => {
    rememberShelf('generate-videos', '/models/kling/')
    expect(lastShelf('/models/flux/')).toBeUndefined()
    expect(lastShelf('/models/kling/')).toBeUndefined()
  })

  it('browses on when the browser refuses its own storage', () => {
    const denied = vi
      .spyOn(window, 'sessionStorage', 'get')
      .mockImplementation(() => {
        throw new Error('access to storage is denied')
      })

    try {
      expect(() =>
        rememberShelf('generate-videos', '/models/kling/')
      ).not.toThrow()
      expect(lastShelf('/models/kling/')).toBeUndefined()
    } finally {
      denied.mockRestore()
    }
  })
})
