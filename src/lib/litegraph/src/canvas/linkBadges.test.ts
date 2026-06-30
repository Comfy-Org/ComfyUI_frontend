import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LLink } from '@/lib/litegraph/src/LLink'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

import {
  clearLinkBadgeHitAreas,
  drawHiddenLinkBadges,
  drawPendingLinkBadges,
  enqueueHiddenLinkBadges,
  isLinkRevealed,
  linkBadgeText,
  promptRenameLinkBadge,
  queryLinkBadgeAtPoint,
  setRevealedLinks
} from './linkBadges'

function mockCtx(): CanvasRenderingContext2D {
  return createMockCanvas2DContext({
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    measureText: vi.fn().mockReturnValue({ width: 50 } as TextMetrics),
    roundRect: vi.fn(),
    fillText: vi.fn()
  })
}

describe('linkBadgeText', () => {
  it('uses the trimmed label when present', () => {
    const link = new LLink(1, 'MODEL', 4, 0, 5, 0)
    link.label = '  Checkpoint  '
    expect(linkBadgeText(link)).toBe('Checkpoint')
  })

  it('falls back to the link type when there is no label', () => {
    const link = new LLink(1, 'MODEL', 4, 0, 5, 0)
    expect(linkBadgeText(link)).toBe('MODEL')
  })
})

describe('drawHiddenLinkBadges + queryLinkBadgeAtPoint', () => {
  beforeEach(() => {
    clearLinkBadgeHitAreas()
  })

  it('registers a hit area near each socket that resolves to the link id', () => {
    const ctx = mockCtx()
    const link = new LLink(7, 'MODEL', 4, 0, 5, 0)

    drawHiddenLinkBadges(ctx, link, [100, 100], [400, 200], '#cab8ff')

    // Output badge sits just right of the output socket (100, 100)
    expect(queryLinkBadgeAtPoint(120, 100)).toBe(7)
    // Input badge sits just left of the input socket (400, 200)
    expect(queryLinkBadgeAtPoint(360, 200)).toBe(7)
    // Empty space between the sockets is not a badge
    expect(queryLinkBadgeAtPoint(250, 150)).toBeUndefined()
  })

  it('clears hit areas between frames', () => {
    const ctx = mockCtx()
    const link = new LLink(7, 'MODEL', 4, 0, 5, 0)
    drawHiddenLinkBadges(ctx, link, [100, 100], [400, 200], '#cab8ff')

    clearLinkBadgeHitAreas()

    expect(queryLinkBadgeAtPoint(120, 100)).toBeUndefined()
  })

  it('draws nothing for an empty badge text', () => {
    const ctx = mockCtx()
    const link = new LLink(7, '', 4, 0, 5, 0)

    drawHiddenLinkBadges(ctx, link, [100, 100], [400, 200], '#cab8ff')

    expect(queryLinkBadgeAtPoint(120, 100)).toBeUndefined()
  })

  it('stacks badges that share an output socket so they do not overlap', () => {
    const ctx = mockCtx()
    // Both links leave the same output socket (100, 100) for different inputs.
    drawHiddenLinkBadges(
      ctx,
      new LLink(1, 'IMAGE', 4, 0, 5, 0),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )
    drawHiddenLinkBadges(
      ctx,
      new LLink(2, 'IMAGE', 4, 0, 6, 0),
      [100, 100],
      [400, 300],
      '#cab8ff'
    )

    // First link keeps the socket row; the second stacks onto a lower row.
    expect(queryLinkBadgeAtPoint(120, 100)).toBe(1)
    const secondBadgeBelow = Array.from({ length: 80 }, (_, i) => 101 + i).some(
      (y) => queryLinkBadgeAtPoint(120, y) === 2
    )
    expect(secondBadgeBelow).toBe(true)
  })

  it('keeps badges of nearby sockets from overlapping', () => {
    const ctx = mockCtx()
    // The IMAGE socket (100, 100) fans to two inputs; the MASK socket sits just
    // below it — close enough that naive downward stacking would collide.
    drawHiddenLinkBadges(
      ctx,
      new LLink(1, 'IMAGE', 4, 0, 5, 0),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )
    drawHiddenLinkBadges(
      ctx,
      new LLink(2, 'IMAGE', 4, 0, 6, 0),
      [100, 100],
      [400, 300],
      '#cab8ff'
    )
    drawHiddenLinkBadges(
      ctx,
      new LLink(3, 'MASK', 4, 1, 7, 0),
      [100, 118],
      [400, 400],
      '#cab8ff'
    )

    const rows = Array.from({ length: 160 }, (_, i) => 80 + i)
    const bandOf = (id: number) => {
      const ys = rows.filter((y) => queryLinkBadgeAtPoint(120, y) === id)
      return { lo: Math.min(...ys), hi: Math.max(...ys) }
    }
    const [a, b, c] = [bandOf(1), bandOf(2), bandOf(3)]

    // Each badge occupies a real, hit-testable band...
    for (const band of [a, b, c]) expect(band.lo).toBeLessThanOrEqual(band.hi)
    // ...and the bands are disjoint, so no two badges overlap.
    const disjoint = (p: typeof a, q: typeof a) => p.hi < q.lo || q.hi < p.lo
    expect(disjoint(a, b) && disjoint(b, c) && disjoint(a, c)).toBe(true)
  })

  it('defers enqueued badges until the pending pass is flushed', () => {
    const ctx = mockCtx()
    enqueueHiddenLinkBadges(
      new LLink(9, 'MODEL', 4, 0, 5, 0),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )

    // Enqueuing alone draws nothing — badges paint above the noodles later.
    expect(queryLinkBadgeAtPoint(120, 100)).toBeUndefined()

    drawPendingLinkBadges(ctx)
    expect(queryLinkBadgeAtPoint(120, 100)).toBe(9)
  })
})

type RenamePrompt = (
  title: string,
  value: string | number,
  callback: (value: string) => void,
  event: CanvasPointerEvent
) => unknown

describe('promptRenameLinkBadge', () => {
  const event = {} as CanvasPointerEvent
  const renameHost = (prompt: RenamePrompt, setDirty = vi.fn()) => ({
    prompt,
    setDirty,
    emitBeforeChange: vi.fn(),
    emitAfterChange: vi.fn()
  })

  it('sets the trimmed prompt value as the label and redraws', () => {
    const link = new LLink(1, 'MODEL', 4, 0, 5, 0)
    const setDirty = vi.fn()
    const prompt = vi.fn(
      (_t: string, _v: string | number, cb: (value: string) => void) =>
        cb('  Backbone  ')
    )

    promptRenameLinkBadge(renameHost(prompt, setDirty), link, event)

    expect(link.label).toBe('Backbone')
    expect(setDirty).toHaveBeenCalledWith(false, true)
  })

  it('clears the label when the prompt value is blank', () => {
    const link = new LLink(1, 'MODEL', 4, 0, 5, 0)
    link.label = 'Old'
    const prompt = vi.fn(
      (_t: string, _v: string | number, cb: (value: string) => void) => cb('  ')
    )

    promptRenameLinkBadge(renameHost(prompt), link, event)

    expect(link.label).toBeUndefined()
  })

  it('seeds the editor with the current badge text', () => {
    const link = new LLink(1, 'MODEL', 4, 0, 5, 0)
    const prompt = vi.fn()

    promptRenameLinkBadge(renameHost(prompt), link, event)

    expect(prompt).toHaveBeenCalledWith(
      'Rename',
      'MODEL',
      expect.any(Function),
      event
    )
  })

  it('brackets the label change with the graph change lifecycle', () => {
    const link = new LLink(1, 'MODEL', 4, 0, 5, 0)
    const host = renameHost(
      vi.fn((_t: string, _v: string | number, cb: (value: string) => void) =>
        cb('Backbone')
      )
    )

    promptRenameLinkBadge(host, link, event)

    expect(host.emitBeforeChange).toHaveBeenCalled()
    expect(host.emitAfterChange).toHaveBeenCalled()
  })
})

describe('setRevealedLinks / isLinkRevealed', () => {
  beforeEach(() => {
    setRevealedLinks([])
  })

  it('reveals a set of links and flags only real changes', () => {
    expect(setRevealedLinks([5, 6])).toBe(true)
    expect(isLinkRevealed(5)).toBe(true)
    expect(isLinkRevealed(6)).toBe(true)
    expect(isLinkRevealed(7)).toBe(false)

    // Same membership, any order, is not a change.
    expect(setRevealedLinks([6, 5])).toBe(false)

    // Revealing another link (e.g. a second link on the hovered socket).
    expect(setRevealedLinks([5, 6, 7])).toBe(true)
    expect(isLinkRevealed(7)).toBe(true)

    // Moving off clears every reveal.
    expect(setRevealedLinks([])).toBe(true)
    expect(isLinkRevealed(5)).toBe(false)
  })
})
