import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type {
  WorkflowMenuAction,
  WorkflowMenuItem
} from '@/types/workflowMenuItem'

function getNewActions(items: WorkflowMenuItem[]): WorkflowMenuAction[] {
  return items
    .filter((i): i is WorkflowMenuAction => !('separator' in i && i.separator))
    .filter((i) => i.isNew)
}

export function useNewMenuItemIndicator(
  menuItems: MaybeRefOrGetter<WorkflowMenuItem[]>
) {
  const settingStore = useSettingStore()

  const newActions = computed(() => getNewActions(toValue(menuItems)))

  const seenItems = computed<string[]>(
    () => settingStore.get('Comfy.WorkflowActions.SeenItems') ?? []
  )

  const hasUnseenItems = computed(() => {
    const seen = new Set(seenItems.value)
    return newActions.value
      .filter((i) => i.visible !== false)
      .some((i) => !seen.has(i.id))
  })

  function markAsSeen() {
    const actions = newActions.value
    if (!actions.length) return

    const seen = new Set(seenItems.value)
    const visibleIds = actions
      .filter((i) => i.visible !== false)
      .map((i) => i.id)
    const retainedIds = actions
      .filter((i) => i.visible === false && seen.has(i.id))
      .map((i) => i.id)

    const nextSeen = [...visibleIds, ...retainedIds]
    if (nextSeen.length === seen.size && nextSeen.every((id) => seen.has(id)))
      return

    void settingStore.set('Comfy.WorkflowActions.SeenItems', nextSeen)
  }

  return { hasUnseenItems, markAsSeen }
}
