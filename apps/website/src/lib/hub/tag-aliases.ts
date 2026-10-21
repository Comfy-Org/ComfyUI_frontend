// The Hub stores the original tag (e.g. "API") and displays an alias.
const TAG_ALIASES: Record<string, string> = {
  API: 'Partner Nodes'
}

export function tagDisplayName(tag: string): string {
  return TAG_ALIASES[tag] ?? tag
}
