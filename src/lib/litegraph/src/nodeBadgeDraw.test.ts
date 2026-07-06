import { describe, expect, it } from 'vitest'

import type { BadgeData } from '@/types/badgeData'

import { registerBadgeIcon } from './badgeIconRegistry'
import { badgeDrawObjects } from './nodeBadgeDraw'

function coreRow(part: BadgeData['part'], text: string): BadgeData {
  return { kind: 'core', part, text, fgColor: '#fff', bgColor: '#000' }
}

describe('badgeDrawObjects', () => {
  it('joins core parts into one badge in id, lifecycle, source order', () => {
    const badges = badgeDrawObjects({}, [
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
    const badges = badgeDrawObjects({}, [
      coreRow('source', 'a'.repeat(40)),
      coreRow('id', '#5')
    ])

    expect(badges[0].text).toHaveLength(31)
    expect(badges[0].text.endsWith('...')).toBe(true)
  })

  it('draws credits rows separately with their registered icon', () => {
    registerBadgeIcon('test-icon', { unicode: 'X', fontFamily: 'test' })
    const badges = badgeDrawObjects({}, [
      coreRow('id', '#5'),
      {
        kind: 'credits',
        text: '$0.04',
        iconKey: 'test-icon',
        fgColor: '#fff',
        bgColor: '#8D6932'
      }
    ])

    expect(badges).toHaveLength(2)
    expect(badges[1].text).toBe('$0.04')
    expect(badges[1].bgColor).toBe('#8D6932')
    expect(badges[1].icon?.unicode).toBe('X')
  })

  it('keeps an unknown icon key iconless', () => {
    const badges = badgeDrawObjects({}, [
      { kind: 'credits', text: '$1', iconKey: 'nope' }
    ])

    expect(badges[0].icon).toBeUndefined()
  })

  it('reuses draw objects until the rows change content', () => {
    const node = {}
    const rows: BadgeData[] = [coreRow('id', '#5')]

    const first = badgeDrawObjects(node, rows)
    const second = badgeDrawObjects(node, [coreRow('id', '#5')])
    expect(second[0]).toBe(first[0])

    const third = badgeDrawObjects(node, [coreRow('id', '#6')])
    expect(third[0]).not.toBe(first[0])
    expect(third[0].text).toBe('#6')
  })
})
