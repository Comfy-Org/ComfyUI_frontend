import { describe, expect, it } from 'vitest'

import {
  EMPTY_SELECTION,
  parseSelectableKey,
  reduceSelection,
  toSelectableKey
} from './selectionState'
import type { SelectionCommand, SelectionState } from './selectionState'

const [a, b, c] = ['1', '2', '3'].map((id) => toSelectableKey('node', id))
const group = toSelectableKey('group', 7)

function selection(...keys: (typeof a)[]): SelectionState {
  return { order: keys }
}

describe('reduceSelection', () => {
  it.for<{
    name: string
    state: SelectionState
    command: SelectionCommand
    order: readonly (typeof a)[]
    status: 'applied' | 'no-op'
  }>([
    {
      name: 'add appends new keys in command order and skips present ones',
      state: selection(a),
      command: { type: 'selection.add', keys: [b, a, c, b] },
      order: [a, b, c],
      status: 'applied'
    },
    {
      name: 'add of already-selected keys is a no-op',
      state: selection(a, b),
      command: { type: 'selection.add', keys: [b, a] },
      order: [a, b],
      status: 'no-op'
    },
    {
      name: 'remove drops keys and keeps the remaining order',
      state: selection(a, b, c),
      command: { type: 'selection.remove', keys: [b] },
      order: [a, c],
      status: 'applied'
    },
    {
      name: 'remove of absent keys is a no-op',
      state: selection(a),
      command: { type: 'selection.remove', keys: [b] },
      order: [a],
      status: 'no-op'
    },
    {
      name: 'replace dedupes and keeps command order',
      state: selection(a, b),
      command: { type: 'selection.replace', keys: [c, group, c] },
      order: [c, group],
      status: 'applied'
    },
    {
      name: 'replace with the same order is a no-op',
      state: selection(a, b),
      command: { type: 'selection.replace', keys: [a, b] },
      order: [a, b],
      status: 'no-op'
    },
    {
      name: 'clear empties the selection',
      state: selection(a, group),
      command: { type: 'selection.clear' },
      order: [],
      status: 'applied'
    },
    {
      name: 'clear of an empty selection is a no-op',
      state: EMPTY_SELECTION,
      command: { type: 'selection.clear' },
      order: [],
      status: 'no-op'
    }
  ])('$name', ({ state, command, order, status }) => {
    const transition = reduceSelection(state, command)
    expect(transition.status).toBe(status)
    expect(transition.state.order).toEqual(order)
    if (status === 'no-op') expect(transition.state).toBe(state)
  })

  it.for<SelectionCommand>([
    { type: 'selection.add', keys: [b, c] },
    { type: 'selection.remove', keys: [a] },
    { type: 'selection.replace', keys: [c, group] },
    { type: 'selection.clear' }
  ])('$type applied twice is a no-op the second time', (command) => {
    const once = reduceSelection(selection(a, b), command)
    const twice = reduceSelection(once.state, command)
    expect(twice.status).toBe('no-op')
    expect(twice.state).toBe(once.state)
  })

  it('does not mutate the previous state', () => {
    const state = selection(a)
    reduceSelection(state, { type: 'selection.add', keys: [b] })
    expect(state.order).toEqual([a])
  })
})

describe('selectable keys', () => {
  it('round-trips kind and id, including ids containing separators', () => {
    const key = toSelectableKey('node', 'a:b')
    expect(key).toBe('node:a:b')
    expect(parseSelectableKey(key)).toEqual({ kind: 'node', id: 'a:b' })
    expect(parseSelectableKey(group)).toEqual({ kind: 'group', id: '7' })
  })
})
