import { assert, describe, expect, it } from 'vitest'

import {
  installMenuBoundary,
  toClosureOnlyVueItems
} from './menuBoundaryPrototype'
import type { LegacyItems, MenuAction } from './menuBoundaryPrototype'

describe('explicit menu boundary prototype', () => {
  it('consumes the final patched menu once, preserving removals, duplicate labels and wrapped actions', () => {
    let builds = 0
    const effects: string[] = []
    const target = { getMenuOptions: (): LegacyItems => [] }
    const restore = installMenuBoundary(target, (): MenuAction[] => {
      builds++
      return [
        { kind: 'action', label: 'Remove', run: () => effects.push('removed') },
        { kind: 'action', label: 'Same', run: () => effects.push('first') },
        { kind: 'action', label: 'Same', run: () => effects.push('second') }
      ]
    })
    const previous = target.getMenuOptions
    target.getMenuOptions = function () {
      return previous
        .call(this)
        .slice(1)
        .reverse()
        .map((item) => {
          assert.isNotNull(item)
          const callback = item.callback
          assert.isDefined(callback)
          return {
            ...item,
            callback: () => {
              effects.push('wrapper')
              Reflect.apply(callback, undefined, [])
            }
          }
        })
    }
    const projected = toClosureOnlyVueItems(target.getMenuOptions())
    assert(projected.kind === 'vue')
    const items = projected.items
    expect(items.map((item) => item.label)).toEqual(['Same', 'Same'])
    const first = items[0]
    assert.isDefined(first)
    assert.isDefined(first.command)
    first.command({ originalEvent: new Event('select'), item: first })
    expect(effects).toEqual(['wrapper', 'second'])
    expect(builds).toBe(1)
    restore()
    expect(target.getMenuOptions()).toEqual([])
  })

  it('allows a complete override without regenerating core items', () => {
    let builds = 0
    const target = { getMenuOptions: (): LegacyItems => [] }
    installMenuBoundary(target, () => {
      builds++
      return [{ kind: 'action', label: 'Core', run: () => {} }]
    })
    target.getMenuOptions = () => [{ content: 'Replacement' }]
    const projected = toClosureOnlyVueItems(target.getMenuOptions())
    assert(projected.kind === 'vue')
    expect(projected.items.map((item) => item.label)).toEqual(['Replacement'])
    expect(builds).toBe(0)
  })

  it('preserves declarative submenu children and runs their actions only on selection', () => {
    const effects: string[] = []
    const projected = toClosureOnlyVueItems([
      {
        content: 'Node type',
        has_submenu: true,
        submenu: {
          options: [
            {
              content: 'Create node',
              callback: () => {
                effects.push('created')
              }
            }
          ]
        }
      }
    ])
    assert(projected.kind === 'vue')
    expect(projected.items).toMatchObject([
      { label: 'Node type', items: [{ label: 'Create node' }] }
    ])
    expect(effects).toEqual([])
    const child = projected.items[0]?.items?.[0]
    assert.isDefined(child)
    assert.isDefined(child.command)
    child.command({ originalEvent: new Event('select'), item: child })
    expect(effects).toEqual(['created'])
  })

  it('requires the native route for imperative submenus without executing them during assembly', () => {
    let effects = 0
    expect(
      toClosureOnlyVueItems([
        {
          content: 'Native submenu',
          has_submenu: true,
          callback: () => {
            effects++
          }
        }
      ])
    ).toEqual({
      kind: 'native',
      reason: 'Imperative submenus require the native route'
    })
    expect(effects).toBe(0)
  })
})
