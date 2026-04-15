import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

import type {
  AssetItem,
  AssetUserMetadata
} from '@/platform/assets/schemas/assetSchema'
import type { UserProperties } from '@/platform/assets/schemas/userPropertySchema'
import { getAssetUserProperties } from '@/platform/assets/schemas/userPropertySchema'

function getEffectiveProperties(
  asset: AssetItem,
  pendingByAsset: Record<string, AssetUserMetadata>
): UserProperties {
  const pending = pendingByAsset[asset.id]
  return (
    (pending?.user_properties as UserProperties | undefined) ??
    getAssetUserProperties(asset.user_metadata)
  )
}

export function useMultiPropertyEditing(
  allAssets: Ref<AssetItem[]>,
  pendingByAsset: Ref<Record<string, AssetUserMetadata>>,
  debouncedFlushAllSelected: () => void
) {
  const multiPropertyCounts = computed(() => {
    const counts = new Map<string, number>()
    for (const asset of allAssets.value) {
      const props = getEffectiveProperties(asset, pendingByAsset.value)
      for (const key of Object.keys(props)) {
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return counts
  })

  // Stable key ordering: existing keys keep position, new keys append, removed
  // keys are filtered out. Prevents reordering on value/count changes.
  const stableKeyOrder = ref<string[]>([])
  watch(
    multiPropertyCounts,
    (counts) => {
      const currentKeys = new Set(counts.keys())
      const kept = stableKeyOrder.value.filter((k) => currentKeys.has(k))
      const added = [...currentKeys].filter(
        (k) => !stableKeyOrder.value.includes(k)
      )
      stableKeyOrder.value = [...kept, ...added]
    },
    { immediate: true, flush: 'sync' }
  )

  const multiMixedKeys = computed(() => {
    const mixed = new Set<string>()
    for (const key of multiPropertyCounts.value.keys()) {
      const seen = new Set<string>()
      for (const asset of allAssets.value) {
        const props = getEffectiveProperties(asset, pendingByAsset.value)
        const prop = props[key]
        if (prop) {
          seen.add(JSON.stringify({ type: prop.type, value: prop.value }))
          if (seen.size > 1) {
            mixed.add(key)
            break
          }
        }
      }
    }
    return mixed
  })

  const multiUserProperties = computed<UserProperties>({
    get: () => {
      const union: UserProperties = {}
      let order = 0

      for (const key of stableKeyOrder.value) {
        for (const asset of allAssets.value) {
          const props = getEffectiveProperties(asset, pendingByAsset.value)
          if (props[key]) {
            union[key] = { ...props[key], _order: order++ }
            break
          }
        }
      }
      return union
    },
    set: (newProps: UserProperties) => {
      const oldProps = multiUserProperties.value
      const newKeys = new Set(Object.keys(newProps))
      const oldKeys = new Set(Object.keys(oldProps))

      const removed = [...oldKeys].filter((k) => !newKeys.has(k))
      const addedOrUpdated = [...newKeys].filter((k) => {
        if (!oldKeys.has(k)) return true
        const oldVal = oldProps[k]
        const newVal = newProps[k]
        return oldVal.type !== newVal.type || oldVal.value !== newVal.value
      })

      if (removed.length === 0 && addedOrUpdated.length === 0) return

      for (const asset of allAssets.value) {
        const currentProps = {
          ...getEffectiveProperties(asset, pendingByAsset.value)
        }
        let changed = false

        for (const key of removed) {
          if (key in currentProps) {
            delete currentProps[key]
            changed = true
          }
        }

        for (const key of addedOrUpdated) {
          const newProp = newProps[key]
          const existing = currentProps[key]
          currentProps[key] = {
            ...newProp,
            _order: existing?._order ?? newProp._order
          }
          changed = true
        }

        if (changed) {
          pendingByAsset.value[asset.id] = {
            ...(pendingByAsset.value[asset.id] ?? {}),
            user_properties: currentProps
          }
        }
      }

      debouncedFlushAllSelected()
    }
  })

  return { multiPropertyCounts, multiMixedKeys, multiUserProperties }
}
