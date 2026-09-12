// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { lastShelf, rememberShelf } from './shelf-memory'

afterEach(() => {
  sessionStorage.clear()
})

describe('shelf memory', () => {
  it('reads back the shelf the visitor was standing on', () => {
    rememberShelf('generate-videos')
    expect(lastShelf()).toBe('generate-videos')
  })

  it('remembers nothing before the catalogue has been browsed', () => {
    expect(lastShelf()).toBeUndefined()
  })

  it('ignores a value that is no longer a shelf', () => {
    sessionStorage.setItem('comfy-models-shelf', 'retired-category')
    expect(lastShelf()).toBeUndefined()
  })

  it('says nothing when the stored value is empty', () => {
    sessionStorage.setItem('comfy-models-shelf', '')
    expect(lastShelf()).toBeUndefined()
  })

  it('browses on when the browser refuses its own storage', () => {
    const denied = vi
      .spyOn(window, 'sessionStorage', 'get')
      .mockImplementation(() => {
        throw new Error('access to storage is denied')
      })

    expect(() => rememberShelf('generate-videos')).not.toThrow()
    expect(lastShelf()).toBeUndefined()

    denied.mockRestore()
  })
})
