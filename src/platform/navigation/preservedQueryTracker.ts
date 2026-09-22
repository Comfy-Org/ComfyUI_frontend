import type { LocationQuery, Router } from 'vue-router'

import {
  capturePreservedQuery,
  clearPreservedQuery,
  hydratePreservedQuery
} from '@/platform/navigation/preservedQueryManager'

interface PreservedQueryDefinition {
  namespace: string
  keys: string[]
  requiredKey?: string
  /**
   * When set, keys present in the query are removed from the client-side URL
   * before navigation completes. Later guards, afterEach hooks, and views must
   * read a strip-marked key from the preserved-query stash instead of
   * route.query or fullPath. Because the stash is the only carrier after
   * stripping, captures for the namespace merge into the existing stash and an
   * explicitly empty value clears the stashed key; non-strip namespaces keep
   * replace-on-capture semantics.
   */
  stripAfterCapture?: boolean
  /**
   * When set, a key present as a repeated (array) value, or present with no
   * value at all (`?key`, which the router reads as `null`, in a single
   * value or inside an array), is captured as an ambiguous marker instead of
   * silently picking one: repeated values join with `,`; a lone `null`
   * becomes a bare `,`. Both are strings outside any real id's charset, so
   * they read back as invalid rather than resolving to one of several
   * colliding values or to "absent" (`capturePreservedQuery` itself drops a
   * null/empty value as not worth capturing).
   */
  rejectRepeated?: true
}

/** Marks each `keys` entry present as a repeated value, or with no value at
 * all, with a charset-invalid string capturePreservedQuery would otherwise
 * either mis-simplify (repeated → first entry) or drop (null → nothing).
 * Leaves every other key untouched. */
function withAmbiguityMarked(
  query: LocationQuery,
  keys: string[]
): LocationQuery {
  const result = { ...query }
  for (const key of keys) {
    const value = result[key]
    const values = Array.isArray(value) ? value : [value]
    const isRepeated = values.length > 1
    const hasBareEntry = values.includes(null)
    if (!isRepeated && !hasBareEntry) continue
    result[key] = values.map((entry) => entry ?? '').join(',') || ','
  }
  return result
}

export const installPreservedQueryTracker = (
  router: Router,
  definitions: PreservedQueryDefinition[]
) => {
  router.beforeEach((to, _from, next) => {
    const queryKeys = new Set(Object.keys(to.query))
    const keysToStrip = new Set<string>()

    definitions.forEach(
      ({ namespace, keys, requiredKey, stripAfterCapture, rejectRepeated }) => {
        hydratePreservedQuery(namespace)
        const presentKeys = keys.filter((key) => queryKeys.has(key))
        if (presentKeys.length === 0) return
        if (requiredKey && !queryKeys.has(requiredKey)) {
          clearPreservedQuery(namespace)
          return
        }
        const captureQuery = rejectRepeated
          ? withAmbiguityMarked(to.query, keys)
          : to.query
        capturePreservedQuery(namespace, captureQuery, keys, {
          merge: stripAfterCapture
        })
        if (stripAfterCapture) {
          presentKeys.forEach((key) => keysToStrip.add(key))
        }
      }
    )

    if (keysToStrip.size === 0) {
      next()
      return
    }

    const cleanedQuery = { ...to.query }
    keysToStrip.forEach((key) => delete cleanedQuery[key])
    next({ path: to.path, query: cleanedQuery, hash: to.hash })
  })
}
