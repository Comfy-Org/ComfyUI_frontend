// The Hub stores the original tag (e.g. "API") and displays an alias.
const TAG_ALIASES: Record<string, string> = {
  API: 'Partner Nodes'
}

export function tagDisplayName(tag: string): string {
  return TAG_ALIASES[tag] ?? tag
}

// Every workflow the Hub carries is one call to a partner node, so the tag
// that says so sits on all of them and tells a reader nothing about this one.
const PLUMBING = new Set(['API'])

/** The tags that say what a workflow is for, rather than how it is wired. */
export function usefulTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => !PLUMBING.has(tag))
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function tagSlug(tag: string): string {
  return slugify(TAG_ALIASES[tag] ?? tag)
}
