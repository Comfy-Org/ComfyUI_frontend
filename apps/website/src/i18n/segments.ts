/**
 * Splitting a translated sentence around the pieces a page supplies.
 *
 * Some sentences wrap styled names or a link: "Standard, Creator and Pro for
 * individual creators, plus our new Teams plan." The pages used to express that
 * by cutting the sentence into fragments and putting the markup between them,
 * which silently forces English word order onto every language — Chinese and
 * Japanese place the same pieces differently, and a translator handed a fragment
 * has no sentence to work with.
 *
 * So the dictionary holds the whole sentence with named slots, and the page
 * decides what each slot renders as. No markup goes into the translation, and
 * the page renders real elements rather than a string of HTML, so Astro escapes
 * the text for us.
 */
export type Segment =
  | { type: 'text'; value: string }
  | { type: 'slot'; name: string }

const SLOT = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g

export function segments(template: string): Segment[] {
  const out: Segment[] = []
  let at = 0

  for (const match of template.matchAll(SLOT)) {
    if (match.index > at) {
      out.push({ type: 'text', value: template.slice(at, match.index) })
    }
    out.push({ type: 'slot', name: match[1] })
    at = match.index + match[0].length
  }

  if (at < template.length) {
    out.push({ type: 'text', value: template.slice(at) })
  }

  return out
}
