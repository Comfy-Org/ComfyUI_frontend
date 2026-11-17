import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { historyKey, isHistoryKey } from './core/historyStorage'
import { plug } from './plug'

describe('the history while the layer is off', () => {
  it('HS-14: nothing of it is read, written or removed', async () => {
    window.localStorage.setItem(historyKey('workflow-w'), 'stored earlier')
    onTestFinished(() => window.localStorage.clear())
    const used = [
      vi.spyOn(window.localStorage, 'getItem'),
      vi.spyOn(window.localStorage, 'setItem'),
      vi.spyOn(window.localStorage, 'removeItem')
    ]
    const register = vi.fn()

    await plug(register)

    const touched = used
      .flatMap((spy) => spy.mock.calls.map(([key]) => key))
      .filter(isHistoryKey)
    const readsOfTheSwitch = used[0].mock.calls.length
    used.forEach((spy) => spy.mockRestore())
    expect(readsOfTheSwitch).toBeGreaterThan(0)
    expect(register).not.toHaveBeenCalled()
    expect(touched).toEqual([])
    expect(window.localStorage.getItem(historyKey('workflow-w'))).toBe(
      'stored earlier'
    )
  })
})
