import { describe, expect, it } from 'vitest'

import { preventNativeCanvasHistory } from './canvasHistoryShortcut'

describe('canvas history shortcuts', () => {
  it.for([
    { name: 'Ctrl Z', key: 'z', ctrlKey: true, prevented: true },
    {
      name: 'Cmd Shift Z',
      key: 'z',
      metaKey: true,
      shiftKey: true,
      prevented: true
    },
    { name: 'Ctrl Y', key: 'y', ctrlKey: true, prevented: true },
    {
      name: 'Ctrl Alt Z',
      key: 'z',
      ctrlKey: true,
      altKey: true,
      prevented: false
    },
    { name: 'bare Z', key: 'z', prevented: false },
    { name: 'Ctrl C', key: 'c', ctrlKey: true, prevented: false }
  ])(
    'reserves $name for workflow history when appropriate',
    ({ name: _, prevented, ...options }) => {
      const event = new KeyboardEvent('keydown', {
        ...options,
        cancelable: true
      })
      preventNativeCanvasHistory(event)
      expect(event.defaultPrevented).toBe(prevented)
    }
  )
})
