import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeyboard } from '@/composables/maskeditor/useKeyboard'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const dispatchKeyDown = (
  init: KeyboardEventInit & { key: string }
): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
}

const dispatchKeyUp = (key: string): void => {
  document.dispatchEvent(new KeyboardEvent('keyup', { key }))
}

describe('useKeyboard', () => {
  let keyboard: ReturnType<typeof useKeyboard>

  beforeEach(() => {
    keyboard = useKeyboard()
    keyboard.addListeners()
  })

  afterEach(() => {
    keyboard.removeListeners()
  })

  describe('isKeyDown', () => {
    it('should return false for keys that have not been pressed', () => {
      expect(keyboard.isKeyDown('a')).toBe(false)
    })

    it('should return true after a key is pressed', () => {
      dispatchKeyDown({ key: 'a' })

      expect(keyboard.isKeyDown('a')).toBe(true)
    })

    it('should return false after a pressed key is released', () => {
      dispatchKeyDown({ key: 'a' })
      dispatchKeyUp('a')

      expect(keyboard.isKeyDown('a')).toBe(false)
    })

    it('should track multiple keys independently', () => {
      dispatchKeyDown({ key: 'a' })
      dispatchKeyDown({ key: 'b' })

      expect(keyboard.isKeyDown('a')).toBe(true)
      expect(keyboard.isKeyDown('b')).toBe(true)

      dispatchKeyUp('a')

      expect(keyboard.isKeyDown('a')).toBe(false)
      expect(keyboard.isKeyDown('b')).toBe(true)
    })
  })

  describe('handleKeyDown', () => {
    it('should not duplicate the same key on repeated keydown events', () => {
      dispatchKeyDown({ key: 'a' })
      dispatchKeyDown({ key: 'a' })
      dispatchKeyDown({ key: 'a' })
      dispatchKeyUp('a')

      expect(keyboard.isKeyDown('a')).toBe(false)
    })

    it('should prevent default and blur the active element on space', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()
      const blurSpy = vi.spyOn(input, 'blur')

      const event = dispatchKeyDown({ key: ' ' })

      expect(event.defaultPrevented).toBe(true)
      expect(blurSpy).toHaveBeenCalledTimes(1)
      expect(keyboard.isKeyDown(' ')).toBe(true)
    })

    it('should not throw when activeElement is null', () => {
      Object.defineProperty(document, 'activeElement', {
        value: null,
        configurable: true
      })

      try {
        expect(() => dispatchKeyDown({ key: ' ' })).not.toThrow()
      } finally {
        Reflect.deleteProperty(document, 'activeElement')
      }
    })

    it('should leave undo and redo combos to the keybinding dispatcher', () => {
      const history = useMaskEditorStore().canvasHistory
      const undo = vi.spyOn(history, 'undo')
      const redo = vi.spyOn(history, 'redo')

      const event = dispatchKeyDown({ key: 'z', ctrlKey: true })
      dispatchKeyDown({ key: 'y', ctrlKey: true })
      dispatchKeyDown({ key: 'Z', ctrlKey: true, shiftKey: true })

      expect(undo).not.toHaveBeenCalled()
      expect(redo).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('addListeners', () => {
    it('should clear all tracked keys when the window loses focus', () => {
      dispatchKeyDown({ key: 'a' })
      dispatchKeyDown({ key: 'b' })

      window.dispatchEvent(new Event('blur'))

      expect(keyboard.isKeyDown('a')).toBe(false)
      expect(keyboard.isKeyDown('b')).toBe(false)
    })
  })

  describe('removeListeners', () => {
    it('should stop responding to keyboard events after removal', () => {
      keyboard.removeListeners()

      dispatchKeyDown({ key: 'a' })

      expect(keyboard.isKeyDown('a')).toBe(false)
    })

    it('should stop clearing keys on window blur after removal', () => {
      dispatchKeyDown({ key: 'a' })
      keyboard.removeListeners()

      window.dispatchEvent(new Event('blur'))

      expect(keyboard.isKeyDown('a')).toBe(true)
    })
  })
})
