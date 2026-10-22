import type { ProfileChoice } from './profile-client'
import { searchProfiles, validProfileQuery } from './profile-client'

// One lookup per canonical account ID for the page's lifetime: a Draft table
// lists the same few authors on many rows. A failed lookup is forgotten so a
// later row can try again.
const lookups = new Map<string, Promise<ProfileChoice | undefined>>()

/**
 * The public profile behind a canonical Comfy account ID, found through the
 * same staff profile search the editor's author picker uses. Resolves to
 * undefined when the account has no public profile or the search fails.
 */
export function resolveAuthorProfile(
  uid: string
): Promise<ProfileChoice | undefined> {
  if (!validProfileQuery(uid)) return Promise.resolve(undefined)
  const known = lookups.get(uid)
  if (known) return known
  const lookup = searchProfiles(uid, new AbortController().signal).then(
    (result) => {
      if (!result.ok) lookups.delete(uid)
      return result.ok
        ? result.items.find((item) => item.id === uid)
        : undefined
    }
  )
  lookups.set(uid, lookup)
  return lookup
}
