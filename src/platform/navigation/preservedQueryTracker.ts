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
   * When set, a key present as a repeated (array) value is captured as its
   * values joined with `,` instead of just the first — a string outside any
   * real id's charset, so it reads back as invalid rather than quietly
   * picking one of several colliding values.
   */
  rejectRepeated?: true
}

/** Joins a repeated value for each `keys` entry present as an array in `query`, leaving every other key untouched. */
function withJoinedRepeats(
  query: LocationQuery,
  keys: string[]
): LocationQuery {
  const result = { ...query }
  for (const key of keys) {
    const value = result[key]
    if (Array.isArray(value) && value.length > 1) {
      result[key] = value
        .filter((entry): entry is string => typeof entry === 'string')
        .join(',')
    }
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
          ? withJoinedRepeats(to.query, keys)
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
