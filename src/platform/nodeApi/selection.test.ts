import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import {
  createSelectionObserver,
  provideSelectionSource,
  resetSelectionSource
} from './selection'

const handleFor = (id: string) =>
  ({ id, isDeleted: false }) as unknown as NodeHandle

describe('observing node selection', () => {
  beforeEach(() => resetSelectionSource())

  it('rejects subscriptions before the host provides a source', () => {
    expect(() => createSelectionObserver(handleFor)(() => {})).toThrow(
      ComfyApiError
    )
  })

  it('delivers the complete live node selection as frozen handles', () => {
    let emit: ((ids: readonly string[]) => void) | undefined
    provideSelectionSource((listener) => {
      emit = listener
      return () => {
        emit = undefined
      }
    })
    const listener = vi.fn()
    const stop = createSelectionObserver(handleFor)(listener)

    emit?.(['1', '2'])

    const selection = listener.mock.calls[0][0] as readonly NodeHandle[]
    expect(selection.map(({ id }) => id)).toEqual(['1', '2'])
    expect(Object.isFrozen(selection)).toBe(true)
    stop()
    expect(emit).toBeUndefined()
  })

  it('omits missing and deleted nodes while still reporting an empty selection', () => {
    let emit: ((ids: readonly string[]) => void) | undefined
    provideSelectionSource((listener) => {
      emit = listener
      return () => undefined
    })
    const deleted = { id: '2', isDeleted: true } as unknown as NodeHandle
    const listener = vi.fn()
    createSelectionObserver((id) => {
      if (id === '1') return undefined
      if (id === '2') return deleted
      return handleFor(id)
    })(listener)

    emit?.(['1', '2'])

    expect(listener).toHaveBeenCalledWith([])
  })
})
