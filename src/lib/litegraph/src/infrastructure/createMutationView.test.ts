import { describe, expect, it, vi } from 'vitest'

import {
  createArrayMutationView,
  createMutationView
} from './createMutationView'
import { Rectangle } from './Rectangle'

describe('createMutationView', () => {
  it('commits direct and method mutations only when observed values change', () => {
    const target = new Float64Array([1, 2])
    const commit = vi.fn()
    const view = createMutationView(target, { commit })

    view[0] = 3
    view[0] = 3
    view.set([4, 5])
    view.set([4, 5])

    expect([...view]).toEqual([4, 5])
    expect(commit).toHaveBeenCalledTimes(2)
  })

  it('commits record property assignments and deletions', () => {
    const target: Record<string, number> = { first: 1 }
    const commit = vi.fn()
    const view = createMutationView(target, { commit })

    view.second = 2
    view.second = 2
    delete view.first

    expect(view).toEqual({ second: 2 })
    expect(commit).toHaveBeenCalledTimes(2)
  })

  it('synchronizes before reads and preserves chained mutator identity', () => {
    const target = new Float64Array([1, 2])
    const synchronize = vi.fn(() => target.set([3, 4]))
    const view = createMutationView(target, {
      synchronize,
      commit: vi.fn()
    })

    expect(view[0]).toBe(3)
    expect(view.reverse()).toBe(view)
    expect(synchronize).toHaveBeenCalled()
  })

  it('leaves constructor identity intact for external clone helpers', () => {
    const view = createMutationView([1, 2], { commit: vi.fn() })

    expect(view.constructor).toBe(Array)
  })

  it('observes a shared parent buffer and maps nested views', () => {
    const bounds = new Rectangle(1, 2, 3, 4)
    const commit = vi.fn()
    const pos = createMutationView(bounds.pos, { commit, observe: bounds })
    const size = createMutationView(bounds.size, { commit, observe: bounds })
    const view = createMutationView(bounds, {
      commit,
      mapValue: (property, value) => {
        if (property === 'pos') return pos
        if (property === 'size') return size
        return value
      }
    })

    view.pos[0] = 10
    view.size[1] = 20

    expect(view.pos).toBe(pos)
    expect(view.size).toBe(size)
    expect([...bounds]).toEqual([10, 2, 3, 20])
    expect(commit).toHaveBeenCalledTimes(2)
  })

  it('commits mutations that throw or bypass assignment', () => {
    const target = Object.assign([1, 2], {
      mutateThenThrow(this: number[]) {
        this[0] = 3
        throw new Error('failed mutation')
      }
    })
    const commit = vi.fn()
    const view = createMutationView(target, { commit })

    expect(() => view.mutateThenThrow()).toThrow('failed mutation')
    Reflect.deleteProperty(view, '1')
    Object.defineProperty(view, '0', { value: 4 })

    expect(commit).toHaveBeenCalledTimes(3)
  })

  it('only observes mutating array methods', () => {
    const commit = vi.fn()
    const view = createArrayMutationView([1, 2], commit)

    expect(view.map((value) => value * 2)).toEqual([2, 4])
    view.reverse()

    expect(commit).toHaveBeenCalledOnce()
  })
})
