import { describe, expect, it } from 'vitest'
import { isPlainPrimaryClick } from './navigation-intent'

describe('plain primary navigation', () => {
  it('accepts an unmodified left click', () => {
    expect(isPlainPrimaryClick(new MouseEvent('click'))).toBe(true)
  })
  it.for(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)(
    'preserves %s navigation',
    (key) => {
      expect(
        isPlainPrimaryClick(new MouseEvent('click', { [key]: true }))
      ).toBe(false)
    }
  )
  it('preserves other buttons and already handled clicks', () => {
    expect(isPlainPrimaryClick(new MouseEvent('click', { button: 1 }))).toBe(
      false
    )
    const event = new MouseEvent('click', { cancelable: true })
    event.preventDefault()
    expect(isPlainPrimaryClick(event)).toBe(false)
  })
})
