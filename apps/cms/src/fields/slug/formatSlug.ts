// Slugs stay ASCII so URLs, logs and analytics stay readable. Accents fold to
// their base letter; anything else non-ASCII is dropped, so a title with no
// Latin characters (a zh-CN-only title, say) yields an empty string. Callers
// must treat that as "no slug" rather than storing it — see `slugField`.
export const formatSlug = (value: string): string =>
  value
    .normalize('NFKD') // splits accents off their base letter
    .replace(/[^\x20-\x7E]/g, '') // drops the split-off marks and all other non-ASCII
    .replace(/[^a-zA-Z0-9]+/g, '-') // any run of separators/punctuation collapses to one hyphen
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
