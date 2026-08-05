import { describe, expect, it } from 'vitest'

import type { Document } from '../document'
import { History } from '../history'
import {
  guideAddLive,
  guideEndDrag,
  guideMoveLive,
  sanitizeGuides
} from './guideOps'

function mkDoc(): Document {
  return {
    version: 2,
    width: 800,
    height: 600,
    root: {
      id: 'root',
      kind: 'group',
      children: []
    } as unknown as Document['root'],
    channels: []
  }
}

describe('guide add/move/commit', () => {
  it('adds live, commits as an undoable command', () => {
    const doc = mkDoc()
    const history = new History()
    const idx = guideAddLive(doc, 'x', 100)
    expect(doc.guides).toEqual([{ axis: 'x', pos: 100 }])
    guideMoveLive(doc, idx, 250)
    guideEndDrag(doc, history, idx, { added: true, keep: true })
    expect(doc.guides).toEqual([{ axis: 'x', pos: 250 }])
    expect(history.canUndo()).toBe(true)
    history.undo()
    expect(doc.guides ?? []).toHaveLength(0)
    history.redo()
    expect(doc.guides).toEqual([{ axis: 'x', pos: 250 }])
  })

  it('cancelled add leaves no trace and no history', () => {
    const doc = mkDoc()
    const history = new History()
    const idx = guideAddLive(doc, 'y', 50)
    guideEndDrag(doc, history, idx, { added: true, keep: false })
    expect(doc.guides).toBeUndefined()
    expect(history.canUndo()).toBe(false)
  })

  it('moving an existing guide is undoable back to its old position', () => {
    const doc = mkDoc()
    doc.guides = [{ axis: 'y', pos: 40 }]
    const history = new History()
    guideMoveLive(doc, 0, 90)
    guideEndDrag(doc, history, 0, { added: false, beforePos: 40, keep: true })
    expect(doc.guides![0]!.pos).toBe(90)
    history.undo()
    expect(doc.guides![0]!.pos).toBe(40)
  })

  it('no-op move pushes nothing', () => {
    const doc = mkDoc()
    doc.guides = [{ axis: 'y', pos: 40 }]
    const history = new History()
    guideEndDrag(doc, history, 0, { added: false, beforePos: 40, keep: true })
    expect(history.canUndo()).toBe(false)
  })

  it('dragging an existing guide off-canvas removes it undoably', () => {
    const doc = mkDoc()
    doc.guides = [
      { axis: 'x', pos: 10 },
      { axis: 'y', pos: 20 }
    ]
    const history = new History()
    guideEndDrag(doc, history, 0, { added: false, beforePos: 10, keep: false })
    expect(doc.guides).toEqual([{ axis: 'y', pos: 20 }])
    history.undo()
    expect(doc.guides).toEqual([
      { axis: 'x', pos: 10 },
      { axis: 'y', pos: 20 }
    ])
  })
})

describe('create → move → delete undo sequence', () => {
  it('Ctrl+Z walks back delete, then move, then create', () => {
    const doc = mkDoc()
    const history = new History()

    const idx = guideAddLive(doc, 'x', 100)
    guideEndDrag(doc, history, idx, { added: true, keep: true })
    expect(doc.guides).toEqual([{ axis: 'x', pos: 100 }])

    guideMoveLive(doc, 0, 250)
    guideEndDrag(doc, history, 0, { added: false, beforePos: 100, keep: true })
    expect(doc.guides).toEqual([{ axis: 'x', pos: 250 }])

    guideEndDrag(doc, history, 0, { added: false, beforePos: 250, keep: false })
    expect(doc.guides ?? []).toHaveLength(0)

    history.undo()
    expect(doc.guides).toEqual([{ axis: 'x', pos: 250 }])
    history.undo()
    expect(doc.guides).toEqual([{ axis: 'x', pos: 100 }])
    history.undo()
    expect(doc.guides ?? []).toHaveLength(0)
    expect(history.canUndo()).toBe(false)

    history.redo()
    history.redo()
    history.redo()
    expect(doc.guides ?? []).toHaveLength(0)
    expect(history.canRedo()).toBe(false)
  })
})

describe('sanitizeGuides', () => {
  it('keeps valid rows, drops junk and out-of-range', () => {
    const out = sanitizeGuides(
      [
        { axis: 'x', pos: 10 },
        { axis: 'y', pos: 700 },
        { axis: 'z', pos: 10 },
        { axis: 'x', pos: -5 },
        { axis: 'x', pos: 900 },
        { axis: 'y', pos: 'nope' },
        null
      ],
      800,
      600
    )
    expect(out).toEqual([{ axis: 'x', pos: 10 }])
  })
  it('handles non-arrays', () => {
    expect(sanitizeGuides(undefined, 800, 600)).toEqual([])
    expect(sanitizeGuides('x', 800, 600)).toEqual([])
  })
})
