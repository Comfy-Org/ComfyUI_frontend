import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { HubTaskKey } from './hub-tasks'
import { hubTaskAddress, parseHubTaskKey } from './hub-tasks'

/**
 * The task sidebar's selection, kept in the address as `?task=`
 * while the sidebar is on. A selection that lists nothing opens as All.
 */
export function useHubTaskSelection(
  on: Readonly<Ref<boolean>>,
  shown: (key: HubTaskKey) => boolean
) {
  const taskKey = ref<HubTaskKey>('all')

  function readAddress(search: string) {
    const named = parseHubTaskKey(search)
    taskKey.value = shown(named) ? named : 'all'
  }

  watch([taskKey, on], ([key, sidebarOn]) => {
    if (!sidebarOn) return
    const next = hubTaskAddress(location.href, key)
    if (next !== location.href) history.replaceState(history.state, '', next)
  })

  return { taskKey, readAddress }
}
