import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type {
  WorkflowMenuAction,
  WorkflowMenuItem
} from '@/types/workflowMenuItem'

function getNewItemIds(items: WorkflowMenuItem[]): string[] {
  return items
    .filter((i): i is WorkflowMenuAction => !('separator' in i && i.separator))
    .filter((i) => i.isNew)
    .map((i) => i.id)
}

export function useNewMenuItemIndicator(
  menuItems: MaybeRefOrGetter<WorkflowMenuItem[]>
) {
  const settingStore = useSettingStore()

  const newItemIds = computed(() => getNewItemIds(toValue(menuItems)))

  const seenItems = computed<string[]>(
    () => settingStore.get('Comfy.WorkflowActions.SeenItems') ?? []
  )

  const hasUnseenItems = computed(() => {
    const seen = new Set(seenItems.value)
    return newItemIds.value.some((id) => !seen.has(id))
  })

  function markAsSeen() {
    if (!newItemIds.value.length) return
    void settingStore.set('Comfy.WorkflowActions.SeenItems', [
      ...newItemIds.value
    ])
  }

  return { hasUnseenItems, markAsSeen }
}
