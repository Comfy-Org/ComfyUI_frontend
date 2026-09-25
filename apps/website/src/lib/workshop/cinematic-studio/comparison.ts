import type { SavedCreation } from './creations'

export function comparisonPair(
  items: readonly SavedCreation[],
  leftId?: string,
  rightId?: string
): readonly [SavedCreation | undefined, SavedCreation | undefined] {
  const left = items.find((item) => item.id === leftId) ?? items.at(0)
  const right =
    items.find((item) => item.id === rightId && item.id !== left?.id) ??
    items.find((item) => item.id !== left?.id)
  return [left, right]
}

export function comparisonSource(
  item: SavedCreation,
  items: readonly SavedCreation[]
): SavedCreation | undefined {
  const sourceId = item.settings?.sourceId
  if (!sourceId) return
  return items.find(
    (candidate) =>
      candidate.id !== item.id &&
      (candidate.id === sourceId || candidate.takeId === sourceId)
  )
}

export function comparisonSettings(item: SavedCreation) {
  const settings = item.settings
  return {
    aspect: item.aspect,
    resolution:
      settings?.video?.resolution ??
      settings?.resolution ??
      (settings?.resolutionPixels
        ? `${settings.resolutionPixels}px`
        : undefined),
    duration: settings?.video?.durationSeconds ?? settings?.duration,
    seed: settings?.seed,
    audio: settings?.video?.generateAudio,
    operation: settings?.operation,
    direction: settings?.direction
  }
}

export function comparisonCanShow(
  item: SavedCreation,
  revealed: readonly string[],
  url: string | undefined
): boolean {
  return !!url && (!item.nsfw || revealed.includes(item.id))
}
