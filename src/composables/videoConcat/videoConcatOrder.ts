import type { LinkId } from '@/types/linkId'

export interface ConcatClipSlot {
  name: string
  linkId: LinkId
}

export function arrangeClips<T extends ConcatClipSlot>(
  order: readonly string[],
  clips: readonly T[]
): T[] {
  const byName = new Map(clips.map((clip) => [clip.name, clip]))
  const listed = [...new Set(order)].flatMap((name) => {
    const clip = byName.get(name)
    return clip ? [clip] : []
  })
  return [...listed, ...clips.filter((clip) => !listed.includes(clip))]
}

export function translateOrder(
  order: readonly string[],
  previous: readonly ConcatClipSlot[],
  current: readonly ConcatClipSlot[]
): string[] {
  const previousLinkByName = new Map(
    previous.map((clip) => [clip.name, clip.linkId])
  )
  const currentNameByLink = new Map(
    current.map((clip) => [clip.linkId, clip.name])
  )
  return order.flatMap((name) => {
    const linkId = previousLinkByName.get(name)
    if (linkId === undefined) return [name]
    const renamed = currentNameByLink.get(linkId)
    return renamed === undefined ? [] : [renamed]
  })
}

export function dropIndex(
  pointerX: number,
  tileCenters: readonly number[],
  draggedIndex: number
): number {
  return tileCenters.filter(
    (center, index) => index !== draggedIndex && center < pointerX
  ).length
}

export function moveItem<T>(items: readonly T[], from: number, to: number) {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
