import { PropCommand } from '../commands/prop'
import type { DocGuide, Document } from '../document'
import { Dirty } from '../history'
import type { History } from '../history'

function copyGuides(doc: Document): DocGuide[] {
  return (doc.guides ?? []).map((g) => ({ ...g }))
}

function makeCommand(
  doc: Document,
  label: string,
  before: DocGuide[],
  after: DocGuide[]
): PropCommand<DocGuide[]> {
  return new PropCommand<DocGuide[]>(
    label,
    Dirty.META,
    () => copyGuides(doc),
    (v) => {
      doc.guides = v.length ? v.map((g) => ({ ...g })) : undefined
    },
    before,
    after
  )
}

export function sanitizeGuides(
  raw: unknown,
  width: number,
  height: number
): DocGuide[] {
  if (!Array.isArray(raw)) return []
  const out: DocGuide[] = []
  for (const g of raw) {
    if (!g || (g.axis !== 'x' && g.axis !== 'y')) continue
    const pos = Number(g.pos)
    if (!isFinite(pos)) continue
    const max = g.axis === 'x' ? width : height
    if (pos < 0 || pos > max) continue
    out.push({ axis: g.axis, pos })
  }
  return out
}

export function guideAddLive(
  doc: Document,
  axis: 'x' | 'y',
  pos: number
): number {
  const list = doc.guides ?? []
  doc.guides = [...list, { axis, pos }]
  return doc.guides.length - 1
}

export function guideMoveLive(doc: Document, index: number, pos: number): void {
  const g = doc.guides?.[index]
  if (g) g.pos = pos
}

export interface GuideDragEnd {
  added: boolean
  beforePos?: number
  keep: boolean
}

export function guideEndDrag(
  doc: Document,
  history: History,
  index: number,
  end: GuideDragEnd
): void {
  const current = copyGuides(doc)
  const g = current[index]
  if (!g) return

  if (end.added) {
    const without = current.filter((_, i) => i !== index)
    if (end.keep) {
      history.push(makeCommand(doc, 'Add Guide', without, current))
    } else {
      doc.guides = without.length ? without : undefined
    }
    return
  }

  const beforePos = end.beforePos ?? g.pos
  const before = current.map((x, i) =>
    i === index ? { ...x, pos: beforePos } : { ...x }
  )
  if (end.keep) {
    if (beforePos !== g.pos) {
      history.push(makeCommand(doc, 'Move Guide', before, current))
    }
    return
  }
  const after = current.filter((_, i) => i !== index)
  doc.guides = after.length ? after.map((x) => ({ ...x })) : undefined
  history.push(makeCommand(doc, 'Remove Guide', before, after))
}
