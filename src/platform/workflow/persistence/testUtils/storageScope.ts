import type { StorageScope } from '../base/storageKeys'

/** Constructs branded storage scopes for tests and fixtures only. */
export function unsafeStorageScope(value: string): StorageScope {
  return value as StorageScope
}
