// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'

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
})
