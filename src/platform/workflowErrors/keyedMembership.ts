import { reactive, watch } from 'vue'

export function useKeyedMembership(keys: () => ReadonlySet<string>) {
  const members = reactive(new Set<string>())
  watch(
    keys,
    (next) => {
      for (const key of members) if (!next.has(key)) members.delete(key)
      for (const key of next) members.add(key)
    },
    { immediate: true, flush: 'sync' }
  )
  return (key: string) => members.has(key)
}
