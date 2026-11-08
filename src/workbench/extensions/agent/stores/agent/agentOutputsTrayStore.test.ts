import { describe, expect, it } from 'vitest'

import { useAgentOutputsTrayStore } from './agentOutputsTrayStore'

describe('agentOutputsTrayStore', () => {
  it('starts closed with nothing selected', () => {
    const store = useAgentOutputsTrayStore()

    expect(store.state).toEqual({ phase: 'closed' })
    expect(store.isOpen).toBe(false)
    expect([...store.selectedKeys]).toEqual([])
  })

  it('applies each dispatched event to the state it holds', () => {
    const store = useAgentOutputsTrayStore()

    store.dispatch({ type: 'opened' })
    store.dispatch({ type: 'tileToggled', key: 'job-1' })
    store.dispatch({ type: 'tileToggled', key: 'job-2' })
    store.dispatch({ type: 'moreRevealed' })

    expect(store.state).toEqual({
      phase: 'open',
      selected: new Set(['job-1', 'job-2']),
      revealed: 60,
      more: 'idle'
    })
    expect(store.isOpen).toBe(true)
    expect([...store.selectedKeys]).toEqual(['job-1', 'job-2'])
  })

  it('reports nothing selected once the tray closes', () => {
    const store = useAgentOutputsTrayStore()
    store.dispatch({ type: 'opened' })
    store.dispatch({ type: 'tileToggled', key: 'job-1' })

    store.dispatch({ type: 'added' })

    expect(store.isOpen).toBe(false)
    expect([...store.selectedKeys]).toEqual([])
  })
})
