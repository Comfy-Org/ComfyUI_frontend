import { slugify } from './slugify'

/**
 * Display aliases for template tags.
 * The underlying data uses the original tag name (e.g. "api"),
 * but the site displays the alias (e.g. "Partner Nodes").
 */
const TAG_ALIASES: Record<string, string> = {
  API: 'Partner Nodes'
}

/** Returns the display label for a tag, applying aliases. */
export function tagDisplayName(tag: string): string {
  return TAG_ALIASES[tag] ?? tag
}

/** Returns the URL slug for a tag, using the alias if one exists. */
export function tagSlug(tag: string): string {
  const alias = TAG_ALIASES[tag]
  return slugify(alias ?? tag)
}

/**
 * Returns search-friendly text for a tag, including both the alias and original.
 * Used in the search index so both "api" and "Partner Nodes" match.
 */
export function tagSearchText(tag: string): string {
  const alias = TAG_ALIASES[tag]
  return alias ? `${tag} ${alias}` : tag
}
