/**
 * Per-user persistent storage for a pack's own documents.
 *
 * Distinct from `comfy.settings`, which is for small configured values a user
 * sets once. This is for content a user *authors* and expects to keep: named
 * caption templates, presets, saved prompts. It lives on the server with the
 * user's other data, so it follows them between machines — which `localStorage`
 * does not, and which is why packs reached for `api.storeUserData` directly.
 *
 * Names are logical within the caller's host-selected user/pack namespace.
 * A dotted prefix groups documents; it does not establish pack ownership.
 */
import { api } from '@/scripts/api'

import { ComfyApiError } from './errors'

/**
 * Logical text documents scoped by host-selected user and pack identity.
 * Keys never supply or select the physical storage namespace.
 */
export interface StorageHandle {
  /**
   * Lists logical keys including `namespace`, ready for `get()` or `remove()`.
   * Physical user/pack prefixes stay hidden. Empty folders return an empty array.
   */
  list(namespace: string): Promise<readonly string[]>
  /** The stored text, or `undefined` if there is none. */
  get(name: string): Promise<string | undefined>
  set(name: string, value: string): Promise<void>
  remove(name: string): Promise<void>
}

/**
 * Rejects a name that is not the pack's to write.
 *
 * A bare name would collide across packs; `..` would climb out of the
 * namespace and reach another pack's data or the user's own files.
 */
function assertOwned(name: string, what: string): void {
  if (!name.includes('.')) {
    throw new ComfyApiError(
      `Storage ${what} '${name}' must be namespaced, e.g. 'MyPack.${name}'.`
    )
  }
  if (name.includes('..')) {
    throw new ComfyApiError(`Storage ${what} '${name}' must not contain '..'.`)
  }
}

export function createStorageApi(): StorageHandle {
  const handle: StorageHandle = {
    async list(namespace: string) {
      assertOwned(namespace, 'namespace')
      const entries = await api.listUserDataFullInfo(namespace)
      // Paths come back relative to the namespace, and `get`/`remove` take a
      // namespaced name — so listing then reading failed on its own output.
      return Object.freeze(entries.map((entry) => `${namespace}/${entry.path}`))
    },

    async get(name: string) {
      assertOwned(name, 'name')
      const response = await api.getUserData(name)
      // Nothing stored is a normal answer, not a failure.
      if (response.status === 404) return undefined
      if (!response.ok) {
        throw new ComfyApiError(
          `Could not read '${name}': ${response.status} ${response.statusText}.`
        )
      }
      return await response.text()
    },

    async set(name: string, value: string) {
      assertOwned(name, 'name')
      // `stringify: false` because the value is already text; letting it
      // JSON-encode would quote and escape what the pack wrote.
      await api.storeUserData(name, value, {
        overwrite: true,
        stringify: false,
        throwOnError: true
      })
    },

    async remove(name: string) {
      assertOwned(name, 'name')
      const response = await api.deleteUserData(name)
      if (!response.ok) {
        throw new ComfyApiError(
          `Could not remove '${name}': ${response.status} ${response.statusText}.`
        )
      }
    }
  }
  return Object.freeze(handle)
}
