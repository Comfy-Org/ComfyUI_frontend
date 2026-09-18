/**
 * A placeholder name, checked against the set the string is allowed to carry.
 *
 * Every one of these loops used to end in a wildcard branch: whatever the name
 * was, it rendered the enterprise email, or the support email, or an empty plan
 * name. A translation carrying an unexpected placeholder therefore published
 * the wrong support address rather than failing.
 *
 * `i18n:validate` does compare placeholders between English and each
 * translation, but only across the machine layer — approved human translations
 * live in `source.ts` and never reach it, so they had nothing checking them at
 * all. Throwing stops a static build, which is the last point where this is
 * still cheap to fix.
 *
 * Dropping a placeholder stays legal: the approved Chinese copy leaves out the
 * `{break}` that English carries, and a loop simply never sees it. Only an
 * unexpected name is a fault.
 */
export function requirePlaceholder(
  name: string,
  allowed: readonly string[],
  key: string
): string {
  if (!allowed.includes(name)) {
    throw new Error(
      `${key}: unexpected placeholder {${name}}; expected one of ${allowed.join(', ')}`
    )
  }
  return name
}
