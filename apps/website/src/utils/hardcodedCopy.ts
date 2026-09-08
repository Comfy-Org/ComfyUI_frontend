/**
 * Finds copy typed straight into a page file, where the translation pipeline
 * cannot see it.
 *
 * A string with no key reaches no adapter, so it appears in no report and in no
 * coverage number, and it renders English in every locale. `/zh-CN/enterprise`
 * shipped an English FAQ this way on a locale that is otherwise complete, and
 * nothing said so — which is the whole reason this exists.
 *
 * It reads the frontmatter, not the template. The escaping copy is not markup;
 * it is TypeScript data above the markup:
 *
 *     const faqs = [{ question: 'What is included in Comfy Enterprise?' }]
 *
 * A scan of the templates finds almost nothing, which is why this went unseen.
 */

const FRONTMATTER = /^---\n([\s\S]*?)\n---/

/**
 * A quoted string of four or more words that starts like a sentence.
 *
 * Four is the smallest count that excludes button labels and headings without
 * also excluding real sentences. `Join the waitlist` is three and is missed —
 * accepted, because a threshold low enough to catch it also catches every
 * class list and enum in the file, and a check that cries wolf is a check
 * somebody turns off.
 */
const SENTENCE =
  /(['"`])((?:[A-Za-z][\w'’,.-]*[ ]+){3,}[A-Za-z][\w'’,.!?-]*)\1/g

/** Shapes that are never prose, however many words they contain. */
const NOT_PROSE = [
  /^https?:\/\//,
  /^\//,
  /\.(json|ts|tsx|mdx|md|png|jpe?g|svg|webp|mp4|webm|css)$/,
  /^[a-z0-9-]+(\/[a-z0-9-]+)+$/
]

/**
 * Every phrase in this file's frontmatter that reads like something a person
 * would translate.
 */
export function hardcodedProse(source: string): string[] {
  const frontmatter = FRONTMATTER.exec(source)
  if (!frontmatter) return []

  const found = new Set<string>()
  for (const [, , phrase] of frontmatter[1].matchAll(SENTENCE)) {
    const text = phrase.trim()
    // A Tailwind class list is long, space-separated and entirely lowercase.
    if (text === text.toLowerCase()) continue
    if (NOT_PROSE.some((pattern) => pattern.test(text))) continue
    found.add(text)
  }

  return [...found]
}
