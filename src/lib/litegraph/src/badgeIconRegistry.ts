import type { LGraphIconOptions } from './LGraphIcon'

const icons = new Map<string, LGraphIconOptions>()

/** Maps a {@link BadgeData.iconKey} to canvas icon options. */
export function registerBadgeIcon(
  key: string,
  options: LGraphIconOptions
): void {
  icons.set(key, options)
}

export function resolveBadgeIcon(key: string): LGraphIconOptions | undefined {
  return icons.get(key)
}
