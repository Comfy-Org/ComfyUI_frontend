import { describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { LocalWidgetWrites } from './localWidgetWrites'

function setWidget(value: unknown, widget = 'text'): GraphOperation {
  return { op: 'set_widget', node_id: 7, widget, value }
}

describe('LocalWidgetWrites', () => {
  it.for([
    {
      name: 'holds a differing doc value while the write is out',
      noted: [setWidget('hello')],
      docValue: 'stale',
      held: true
    },
    {
      name: 'settles on the doc value the write carried',
      noted: [setWidget('hello')],
      docValue: 'hello',
      held: false
    },
    {
      name: 'compares by value, not identity',
      noted: [setWidget([1, 2])],
      docValue: [1, 2],
      held: false
    },
    {
      name: 'keeps only the latest local value of a register',
      noted: [setWidget('hel'), setWidget('hello')],
      docValue: 'hel',
      held: true
    },
    {
      name: 'ignores registers nothing local wrote',
      noted: [setWidget('hello', 'seed')],
      docValue: 'anything',
      held: false
    },
    {
      name: 'ignores interior writes, which the applier never projects',
      noted: [
        {
          op: 'set_widget',
          node_id: 7,
          widget: 'text',
          value: 'hello',
          path: ['host'],
          inner_widget: 'text'
        } satisfies GraphOperation
      ],
      docValue: 'anything',
      held: false
    },
    {
      name: 'ignores other op kinds',
      noted: [
        {
          op: 'delete_node',
          node_id: 7,
          removed_links: []
        } satisfies GraphOperation
      ],
      docValue: 'anything',
      held: false
    }
  ])('$name', ({ noted, docValue, held }) => {
    const writes = new LocalWidgetWrites()
    writes.note(noted)
    expect(writes.holds('7', 'text', docValue)).toBe(held)
  })

  it('lifts the hold once, then lets every later value through', () => {
    const writes = new LocalWidgetWrites()
    writes.note([setWidget('hello')])
    expect(writes.holds('7', 'text', 'hello')).toBe(false)
    expect(writes.holds('7', 'text', 'agent')).toBe(false)
  })

  it('settles by the settled op only when it carried the latest local value', () => {
    const writes = new LocalWidgetWrites()
    writes.note([setWidget('hel'), setWidget('hello')])
    writes.settle([setWidget('hel')])
    expect(writes.holds('7', 'text', 'agent')).toBe(true)
    writes.settle([setWidget('hello')])
    expect(writes.holds('7', 'text', 'agent')).toBe(false)
  })

  it('settles against the document only the registers it has caught up on', () => {
    const writes = new LocalWidgetWrites()
    writes.note([setWidget('hello'), setWidget(5, 'seed')])
    writes.settleAgainst((_nodeId, widget) => (widget === 'seed' ? 5 : 'stale'))
    expect(writes.holds('7', 'seed', 9)).toBe(false)
    expect(writes.holds('7', 'text', 'agent')).toBe(true)
  })

  it('forgets every register on clear', () => {
    const writes = new LocalWidgetWrites()
    writes.note([setWidget('hello')])
    writes.clear()
    expect(writes.holds('7', 'text', 'agent')).toBe(false)
  })
})
