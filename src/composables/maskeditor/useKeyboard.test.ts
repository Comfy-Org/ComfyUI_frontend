import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeyboard } from '@/composables/maskeditor/useKeyboard'

type MockCanvasHistory = {
  undo: ReturnType<typeof vi.fn>
  redo: ReturnType<typeof vi.fn>
}

type MockStore = {
  canvasHistory: MockCanvasHistory
}

const { mockStore, mockCanvasHistory } = vi.hoisted(() => {
  const mockCanvasHistory: MockCanvasHistory = {
    undo: vi.fn(),
    redo: vi.fn()
  }

  const mockStore: MockStore = {
    canvasHistory: mockCanvasHistory
  }

  return { mockStore, mockCanvasHistory }
})

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

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
    vi.clearAllMocks()
    document.body.innerHTML = ''
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

    it('should call undo on Ctrl+Z without shift', () => {
      dispatchKeyDown({ key: 'z', ctrlKey: true })

      expect(mockCanvasHistory.undo).toHaveBeenCalledTimes(1)
      expect(mockCanvasHistory.redo).not.toHaveBeenCalled()
    })

    it('should call undo on Meta+Z without shift', () => {
      dispatchKeyDown({ key: 'z', metaKey: true })

      expect(mockCanvasHistory.undo).toHaveBeenCalledTimes(1)
    })

    it('should call redo on Ctrl+Shift+Z', () => {
      dispatchKeyDown({ key: 'Z', ctrlKey: true, shiftKey: true })

      expect(mockCanvasHistory.redo).toHaveBeenCalledTimes(1)
      expect(mockCanvasHistory.undo).not.toHaveBeenCalled()
    })

    it('should call redo on Ctrl+Y', () => {
      dispatchKeyDown({ key: 'y', ctrlKey: true })

      expect(mockCanvasHistory.redo).toHaveBeenCalledTimes(1)
      expect(mockCanvasHistory.undo).not.toHaveBeenCalled()
    })

    it('should not trigger undo or redo when alt is held', () => {
      dispatchKeyDown({ key: 'z', ctrlKey: true, altKey: true })
      dispatchKeyDown({ key: 'y', ctrlKey: true, altKey: true })

      expect(mockCanvasHistory.undo).not.toHaveBeenCalled()
      expect(mockCanvasHistory.redo).not.toHaveBeenCalled()
    })

    it('should not trigger undo or redo without ctrl or meta', () => {
      dispatchKeyDown({ key: 'z' })
      dispatchKeyDown({ key: 'y' })
      dispatchKeyDown({ key: 'Z', shiftKey: true })

      expect(mockCanvasHistory.undo).not.toHaveBeenCalled()
      expect(mockCanvasHistory.redo).not.toHaveBeenCalled()
    })

    it('should ignore Ctrl+Shift+Y', () => {
      dispatchKeyDown({ key: 'Y', ctrlKey: true, shiftKey: true })

      expect(mockCanvasHistory.redo).not.toHaveBeenCalled()
      expect(mockCanvasHistory.undo).not.toHaveBeenCalled()
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
      dispatchKeyDown({ key: 'z', ctrlKey: true })

      expect(keyboard.isKeyDown('a')).toBe(false)
      expect(mockCanvasHistory.undo).not.toHaveBeenCalled()
    })

    it('should stop clearing keys on window blur after removal', () => {
      dispatchKeyDown({ key: 'a' })
      keyboard.removeListeners()

      window.dispatchEvent(new Event('blur'))

      expect(keyboard.isKeyDown('a')).toBe(true)
    })
  })
})
