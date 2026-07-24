import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EventManager } from './EventManager'

describe('EventManager', () => {
  let manager: EventManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new EventManager()
  })

  describe('emitEvent', () => {
    it('does nothing when there are no listeners for the event', () => {
      expect(() => manager.emitEvent('unknown', { x: 1 })).not.toThrow()
    })

    it('invokes every listener registered for the event with the payload', () => {
      const a = vi.fn()
      const b = vi.fn()
      manager.addEventListener('change', a)
      manager.addEventListener('change', b)

      manager.emitEvent('change', { value: 7 })

      expect(a).toHaveBeenCalledWith({ value: 7 })
      expect(b).toHaveBeenCalledWith({ value: 7 })
    })

    it('does not invoke listeners registered for a different event', () => {
      const cb = vi.fn()
      manager.addEventListener('a', cb)

      manager.emitEvent('b', null)

      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('removeEventListener', () => {
    it('detaches a previously added listener', () => {
      const cb = vi.fn()
      manager.addEventListener('change', cb)

      manager.removeEventListener('change', cb)
      manager.emitEvent('change', null)

      expect(cb).not.toHaveBeenCalled()
    })

    it('leaves other listeners on the same event intact', () => {
      const a = vi.fn()
      const b = vi.fn()
      manager.addEventListener('change', a)
      manager.addEventListener('change', b)

      manager.removeEventListener('change', a)
      manager.emitEvent('change', null)

      expect(a).not.toHaveBeenCalled()
      expect(b).toHaveBeenCalled()
    })

    it('is safely a no-op for an event that has never been listened to', () => {
      expect(() => manager.removeEventListener('never', vi.fn())).not.toThrow()
    })
  })
})
