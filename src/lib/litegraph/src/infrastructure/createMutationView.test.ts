import { describe, expect, it, vi } from 'vitest'

import {
  createArrayMutationView,
  createMutationView
} from './createMutationView'

describe('createMutationView', () => {
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
    delete view[1]
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
