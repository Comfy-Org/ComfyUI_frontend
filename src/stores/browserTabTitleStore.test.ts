import { describe, expect, it } from 'vitest'

import { useBrowserTabTitleStore } from './browserTabTitleStore'

describe('useBrowserTabTitleStore', () => {
  it('has no prefix until a source sets one', () => {
    expect(useBrowserTabTitleStore().prefix).toBe('')
  })

  it('shows and clears a source prefix', () => {
    const store = useBrowserTabTitleStore()

    store.setPrefix('feature-a', 'Input needed')
    expect(store.prefix).toBe('[Input needed] ')

    store.setPrefix('feature-a', null)
    expect(store.prefix).toBe('')
  })

  it('composes sources in the order they first set a prefix', () => {
    const store = useBrowserTabTitleStore()

    store.setPrefix('first', 'One')
    store.setPrefix('second', 'Two')
    store.setPrefix('first', 'Uno')

    expect(store.prefix).toBe('[Uno] [Two] ')
  })

  it('clearing one source leaves the others', () => {
    const store = useBrowserTabTitleStore()
    store.setPrefix('first', 'One')
    store.setPrefix('second', 'Two')

    store.setPrefix('first', null)

    expect(store.prefix).toBe('[Two] ')
  })

  it('treats any empty value as clearing the source', () => {
    const store = useBrowserTabTitleStore()

    store.setPrefix('feature-a', 'Input needed')
    store.setPrefix('feature-a', '')
    expect(store.prefix).toBe('')

    store.setPrefix('feature-a', 'Input needed')
    store.setPrefix('feature-a', undefined)
    expect(store.prefix).toBe('')
  })

  it('moves a source to the end when it clears and sets again', () => {
    const store = useBrowserTabTitleStore()
    store.setPrefix('first', 'One')
    store.setPrefix('second', 'Two')

    store.setPrefix('first', null)
    store.setPrefix('first', 'One')

    expect(store.prefix).toBe('[Two] [One] ')
  })
})
