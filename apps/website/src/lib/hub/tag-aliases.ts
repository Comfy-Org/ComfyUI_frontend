// The Hub stores the original tag (e.g. "API") and displays an alias.
const TAG_ALIASES: Record<string, string> = {
  API: 'Partner Nodes'
}

export function tagDisplayName(tag: string): string {
  return TAG_ALIASES[tag] ?? tag
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
