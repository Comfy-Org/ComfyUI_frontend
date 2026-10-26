import type { MatcherFunction } from '@testing-library/vue'

/** Matches an element whose text across its child elements reads `text`. */
export function wholeText(text: string): MatcherFunction {
  return (_content, element) =>
    element?.textContent.replace(/\s+/g, ' ').trim() === text
}
