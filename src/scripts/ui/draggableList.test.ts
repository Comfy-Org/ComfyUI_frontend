import { describe, expect, it } from 'vitest'

describe('draggableList module', () => {
  it('does not append a style element to document.head when imported', async () => {
    const styleCountBefore = document.head.querySelectorAll('style').length

    await import('./draggableList')

    expect(document.head.querySelectorAll('style')).toHaveLength(
      styleCountBefore
    )
  })
})
