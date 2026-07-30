import { describe, expect, it, vi } from 'vitest'

import { createGeometryView } from './createGeometryView'
import { Rectangle } from './Rectangle'

describe('createGeometryView', () => {
  it('commits direct and method mutations only when observed values change', () => {
    const target = new Float64Array([1, 2])
    const commit = vi.fn()
    const view = createGeometryView(target, { commit })

    view[0] = 3
    view[0] = 3
    view.set([4, 5])
    view.set([4, 5])

    expect([...view]).toEqual([4, 5])
    expect(commit).toHaveBeenCalledTimes(2)
  })

  it('synchronizes before reads and preserves chained mutator identity', () => {
    const target = new Float64Array([1, 2])
    const synchronize = vi.fn(() => target.set([3, 4]))
    const view = createGeometryView(target, {
      synchronize,
      commit: vi.fn()
    })

    expect(view[0]).toBe(3)
    expect(view.reverse()).toBe(view)
    expect(synchronize).toHaveBeenCalled()
  })

  it('observes a shared parent buffer and maps nested geometry views', () => {
    const bounds = new Rectangle(1, 2, 3, 4)
    const commit = vi.fn()
    const pos = createGeometryView(bounds.pos, { commit, observe: bounds })
    const size = createGeometryView(bounds.size, { commit, observe: bounds })
    const view = createGeometryView(bounds, {
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
})
