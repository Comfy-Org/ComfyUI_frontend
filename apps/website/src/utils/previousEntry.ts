interface NavigationLike {
  currentEntry: { index: number } | null
  entries: () => readonly { url?: string | null }[]
}

/**
 * The previous same-origin history entry, preferring the Navigation API and
 * falling back to the referrer. `currentEntry` is null for a document with no
 * current history entry, so the index must be checked before use.
 */
export function previousEntryUrl(
  nav: NavigationLike | undefined,
  referrer: string
): string | null {
  const currentIndex = nav?.currentEntry?.index
  const previousUrl =
    nav && currentIndex !== undefined
      ? nav.entries()[currentIndex - 1]?.url
      : undefined
  return previousUrl || referrer || null
}

/** Matches the prefix itself or a path below it, never a sibling like `/events-archive`. */
export function isUrlUnderPath(
  previousUrl: string | null,
  origin: string,
  pathPrefix: string
): boolean {
  if (!previousUrl) return false
  try {
    const { origin: urlOrigin, pathname } = new URL(previousUrl)
    if (urlOrigin !== origin) return false
    return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`)
  } catch {
    return false
  }
}
