import type { StorageScope } from '@/platform/workflow/persistence/base/draftTypes'

export function unsafeStorageScope(value: string): StorageScope {
  return value as StorageScope
}
