import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BadgeData, CoreBadgeData } from '@/types/badgeData'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  badgeDrawObjects,
  badgeRows,
  registerBadgeRowsProvider
} from './nodeBadgeDraw'

function coreRow(part: CoreBadgeData['part'], text: string): BadgeData {
  return { kind: 'core', part, text, fgColor: '#fff', bgColor: '#000' }
}

const registrations: (() => void)[] = []

function register(
  provider: Parameters<typeof registerBadgeRowsProvider>[0]
): () => void {
  const dispose = registerBadgeRowsProvider(provider)
  registrations.push(dispose)
  return dispose
}

afterEach(() => {
  for (const dispose of registrations.splice(0).reverse()) dispose()
})

describe('registerBadgeRowsProvider', () => {
  const node = new LGraphNode('n')
  const firstRows = [coreRow('id', '#1')]
  const secondRows = [coreRow('id', '#2')]
  const firstProvider = () => firstRows
  const secondProvider = () => secondRows

  it('registers and disposes a provider', () => {
    const dispose = register(firstProvider)
    expect(badgeRows(node)).toBe(firstRows)

    dispose()
    expect(badgeRows(node)).toEqual([])
  })

  it('keeps the installed provider when a conflicting registration fails', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    register(firstProvider)
    const disposeConflict = register(secondProvider)
    disposeConflict()

    expect(badgeRows(node)).toBe(firstRows)
    expect(error).toHaveBeenCalledWith(
      'A badge rows provider is already registered'
    )
  })

  it('does not let a stale disposer clear a newer registration', () => {
    const disposeFirst = register(firstProvider)
    register(firstProvider)

    disposeFirst()
    expect(badgeRows(node)).toBe(firstRows)
  })

  it('allows re-registration after disposal', () => {
    register(firstProvider)()
    register(secondProvider)

    expect(badgeRows(node)).toBe(secondRows)
  })
})

describe('badgeDrawObjects', () => {
  it('joins core parts into one badge in id, lifecycle, source order', () => {
    const badges = badgeDrawObjects(new LGraphNode('n'), [
      coreRow('lifecycle', '[BETA]'),
      coreRow('id', '#5'),
      coreRow('source', 'my-pack')
    ])

    expect(badges).toHaveLength(1)
    expect(badges[0].text).toBe('#5 [BETA] my-pack')
    expect(badges[0].fgColor).toBe('#fff')
    expect(badges[0].bgColor).toBe('#000')
  })

  it('truncates the joined core text', () => {
    const badges = badgeDrawObjects(new LGraphNode('n'), [
      coreRow('source', 'a'.repeat(40)),
      coreRow('id', '#5')
    ])

    expect(badges[0].text).toHaveLength(31)
    expect(badges[0].text.endsWith('...')).toBe(true)
  })

  it('draws credits rows separately with their icon', () => {
    const badges = badgeDrawObjects(new LGraphNode('n'), [
      coreRow('id', '#5'),
      {
        kind: 'credits',
        text: '$0.04',
        fgColor: '#fff',
        bgColor: '#8D6932'
      }
    ])

    expect(badges).toHaveLength(2)
    expect(badges[1].text).toBe('$0.04')
    expect(badges[1].bgColor).toBe('#8D6932')
    expect(badges[1].icon?.size).toBe(8)
    expect(badges[1].icon?.image).toBeInstanceOf(Image)
  })

  it('reuses draw objects until the rows array is replaced', () => {
    const node = new LGraphNode('n')
    const rows: BadgeData[] = [coreRow('id', '#5')]

    const first = badgeDrawObjects(node, rows)
    const second = badgeDrawObjects(node, rows)
    expect(second[0]).toBe(first[0])

    const third = badgeDrawObjects(node, [coreRow('id', '#6')])
    expect(third[0]).not.toBe(first[0])
    expect(third[0].text).toBe('#6')
  })
})
