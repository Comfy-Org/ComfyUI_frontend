import type { LocationQuery, Router } from 'vue-router'

import {
  capturePreservedQuery,
  clearPreservedQuery,
  getPreservedQueryParam,
  hydratePreservedQuery
} from '@/platform/navigation/preservedQueryManager'

export interface PreservedQueryDefinition {
  namespace: string
  keys: string[]
  requiredKey?: string | string[]
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
  replaceOnChange?: {
    key: string | string[]
    targetKeys: string[]
    namespaces: string[]
  }
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

function hasChangedQueryValue(
  namespace: string,
  key: string,
  query: LocationQuery
) {
  if (!Object.hasOwn(query, key)) return false
  const incoming = query[key]
  const value = Array.isArray(incoming) ? incoming[0] : incoming
  return value !== getPreservedQueryParam(namespace, key)
}

function clearReplacedIntent(
  query: LocationQuery,
  { namespace, rejectRepeated, replaceOnChange }: PreservedQueryDefinition
) {
  if (!replaceOnChange) return
  const { key, targetKeys, namespaces } = replaceOnChange
  const identityKeys = Array.isArray(key) ? key : [key]
  if (!identityKeys.some((key) => Object.hasOwn(query, key))) return
  const intentKeys = [...identityKeys, ...targetKeys]
  const incoming = rejectRepeated
    ? withAmbiguityMarked(query, intentKeys)
    : query
  if (!intentKeys.some((key) => hasChangedQueryValue(namespace, key, incoming)))
    return

  for (const targetNamespace of [namespace, ...namespaces]) {
    hydratePreservedQuery(targetNamespace)
    clearPreservedQuery(targetNamespace)
  }
}

export const installPreservedQueryTracker = (
  router: Router,
  definitions: PreservedQueryDefinition[]
) => {
  router.beforeEach((to) => {
    const queryKeys = new Set(Object.keys(to.query))
    const keysToStrip = new Set<string>()
    definitions.forEach((definition) =>
      clearReplacedIntent(to.query, definition)
    )

    definitions.forEach(
      ({ namespace, keys, requiredKey, stripAfterCapture, rejectRepeated }) => {
        hydratePreservedQuery(namespace)
        const presentKeys = keys.filter((key) => queryKeys.has(key))
        if (presentKeys.length === 0) return
        const requiredKeys = Array.isArray(requiredKey)
          ? requiredKey
          : requiredKey
            ? [requiredKey]
            : []
        if (
          requiredKeys.length &&
          !requiredKeys.some((key) => queryKeys.has(key))
        ) {
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

    if (keysToStrip.size === 0) return

    const cleanedQuery = { ...to.query }
    keysToStrip.forEach((key) => delete cleanedQuery[key])
    return { path: to.path, query: cleanedQuery, hash: to.hash }
  })
}
