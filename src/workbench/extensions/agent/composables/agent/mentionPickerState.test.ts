import { describe, expect, it } from 'vitest'

import type {
  MentionPickerEvent,
  MentionPickerState
} from './mentionPickerState'
import { transitionMentionPicker } from './mentionPickerState'

const filteredNodes: MentionPickerState = {
  status: 'open',
  section: 'nodes',
  start: 8,
  query: 'Sampler',
  activeIndex: 2
}

describe('mention picker transitions', () => {
  it('reopens a closed submenu at the root with fresh token context', () => {
    const closed = transitionMentionPicker(filteredNodes, { type: 'closed' })
    const reopened = transitionMentionPicker(closed, {
      type: 'queryChanged',
      start: 20,
      query: '',
      firstMatchIndex: 1
    })

    expect(closed).toEqual({ status: 'closed' })
    expect(reopened).toEqual({
      status: 'open',
      section: 'root',
      start: 20,
      query: '',
      activeIndex: 1
    })
  })

  it('starts a chosen section at Back with an empty query', () => {
    const root = transitionMentionPicker(
      { status: 'closed' },
      {
        type: 'queryChanged',
        start: 8,
        query: 'work',
        firstMatchIndex: 0
      }
    )

    expect(
      transitionMentionPicker(root, {
        type: 'sectionSelected',
        section: 'workflows'
      })
    ).toEqual({
      status: 'open',
      section: 'workflows',
      start: 8,
      query: '',
      activeIndex: 0
    })
  })

  it('keeps the section while filtering and returns highlight to Back when cleared', () => {
    const filtered = transitionMentionPicker(filteredNodes, {
      type: 'queryChanged',
      start: 8,
      query: 'VAE',
      firstMatchIndex: 1
    })
    expect(filtered).toEqual({ ...filteredNodes, query: 'VAE', activeIndex: 1 })
    expect(
      transitionMentionPicker(filtered, {
        type: 'queryChanged',
        start: 8,
        query: '',
        firstMatchIndex: 1
      })
    ).toEqual({ ...filteredNodes, query: '', activeIndex: 0 })
  })

  it('retains the query when returning to the root', () => {
    expect(transitionMentionPicker(filteredNodes, { type: 'back' })).toEqual({
      ...filteredNodes,
      section: 'root',
      activeIndex: 0
    })
  })

  it('leaves unavailable nodes for the first eligible root result', () => {
    const nodes: MentionPickerState = { ...filteredNodes, query: '' }
    expect(
      transitionMentionPicker(nodes, {
        type: 'nodesUnavailable',
        firstMatchIndex: 1
      })
    ).toEqual({ ...nodes, section: 'root', activeIndex: 1 })

    const workflows: MentionPickerState = {
      ...nodes,
      section: 'workflows'
    }
    expect(
      transitionMentionPicker(workflows, {
        type: 'nodesUnavailable',
        firstMatchIndex: 1
      })
    ).toEqual(workflows)
  })

  it.for<1 | -1>([1, -1])(
    'wraps highlight in direction %s and skips disabled results',
    (direction) => {
      const state: MentionPickerState = { ...filteredNodes, activeIndex: 0 }
      const moved = transitionMentionPicker(state, {
        type: 'highlightMoved',
        direction,
        disabled: [false, true, false]
      })
      expect(moved).toEqual({ ...state, activeIndex: 2 })
      expect(
        transitionMentionPicker(moved, {
          type: 'highlightMoved',
          direction,
          disabled: [false, true, false]
        })
      ).toEqual(state)
    }
  )

  it.for([[], [true, true]])(
    'leaves the highlight unchanged when no result is selectable: %j',
    (disabled) => {
      expect(
        transitionMentionPicker(filteredNodes, {
          type: 'highlightMoved',
          direction: 1,
          disabled
        })
      ).toEqual(filteredNodes)
    }
  )

  it('uses a hovered result as the starting point for keyboard movement', () => {
    const hovered = transitionMentionPicker(filteredNodes, {
      type: 'highlighted',
      index: 1
    })
    expect(
      transitionMentionPicker(hovered, {
        type: 'highlightMoved',
        direction: -1,
        disabled: [false, false, false]
      })
    ).toEqual({ ...filteredNodes, activeIndex: 0 })
  })

  it.for([
    { query: '', firstMatchIndex: 0, activeIndex: -1 },
    { query: 'por', firstMatchIndex: 0, activeIndex: 0 },
    { query: 'zzz', firstMatchIndex: -1, activeIndex: -1 }
  ])(
    'highlights $activeIndex for a slash query of "$query"',
    ({ query, firstMatchIndex, activeIndex }) => {
      expect(
        transitionMentionPicker(
          { status: 'closed' },
          {
            type: 'queryChanged',
            start: 0,
            query,
            firstMatchIndex,
            trigger: '/'
          }
        )
      ).toEqual({
        status: 'open',
        section: 'skills',
        start: 0,
        query,
        activeIndex
      })
    }
  )

  it.for([
    { direction: 1, activeIndex: 0 },
    { direction: -1, activeIndex: 2 }
  ] as const)(
    'moves from no highlight in direction $direction to row $activeIndex',
    ({ direction, activeIndex }) => {
      const unhighlighted: MentionPickerState = {
        status: 'open',
        section: 'skills',
        start: 0,
        query: '',
        activeIndex: -1
      }
      expect(
        transitionMentionPicker(unhighlighted, {
          type: 'highlightMoved',
          direction,
          disabled: [false, false, false]
        })
      ).toEqual({ ...unhighlighted, activeIndex })
    }
  )

  it.for<MentionPickerEvent>([
    { type: 'sectionSelected', section: 'nodes' },
    { type: 'back' },
    { type: 'nodesUnavailable', firstMatchIndex: 1 },
    { type: 'highlightMoved', direction: 1, disabled: [false] },
    { type: 'highlighted', index: 2 }
  ])('ignores $type while closed', (event) => {
    expect(transitionMentionPicker({ status: 'closed' }, event)).toEqual({
      status: 'closed'
    })
  })
})
