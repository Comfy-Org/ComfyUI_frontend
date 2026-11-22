import {
  useDocumentVisibility,
  useEventListener,
  useIntervalFn
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import {
  DEPLOYMENT_VERSION_FOCUS_GAP_MS,
  DEPLOYMENT_VERSION_WATCH_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { createToastId } from '@/types/toastId'

interface VersionWatchOptions {
  active: MaybeRefOrGetter<boolean>
  reload: () => unknown
}

export function useDeploymentVersionWatch({
  active,
  reload
}: VersionWatchOptions) {
  const { t } = useI18n()
  const store = useDeploymentPickStore()
  const { changeSinceBoot, pickedDeployment, listingRefused } =
    storeToRefs(store)
  const { currentLabel } = useDeploymentLabels()
  const visibility = useDocumentVisibility()
  const toast = useToast()
  const noticeId = createToastId()

  const isWatching = computed(() => toValue(active) && !listingRefused.value)
  let pendingRead: Promise<void> | undefined
  let lastReadAt = -Infinity

  function read() {
    if (pendingRead || !isWatching.value) return
    lastReadAt = Date.now()
    pendingRead = store.load().finally(() => {
      pendingRead = undefined
    })
  }

  function readOnReturn() {
    if (Date.now() - lastReadAt < DEPLOYMENT_VERSION_FOCUS_GAP_MS) return
    read()
  }

  const timer = useIntervalFn(read, DEPLOYMENT_VERSION_WATCH_MS, {
    immediate: false
  })
  watch(
    () => isWatching.value && visibility.value === 'visible',
    (running) => (running ? timer.resume() : timer.pause()),
    { immediate: true }
  )
  useEventListener(window, 'focus', readOnReturn)
  watch(visibility, (now) => {
    if (now === 'visible') readOnReturn()
  })

  function noticeTitle(change: 'release' | 'deployment'): string {
    const deployment = currentLabel.value
    if (change === 'deployment')
      return t(
        'deploymentSwitcher.deploymentChanged',
        { deployment },
        { escapeParameter: false }
      )
    const version = pickedDeployment.value?.release_version
    return version === undefined
      ? t(
          'deploymentSwitcher.versionChangedNoVersion',
          { deployment },
          { escapeParameter: false }
        )
      : t(
          'deploymentSwitcher.versionChanged',
          { deployment, version },
          { escapeParameter: false }
        )
  }

  function showNotice(change: 'release' | 'deployment') {
    toast.info(noticeTitle(change), {
      id: noticeId,
      actions: [
        { label: t('deploymentSwitcher.reload'), onClick: reload },
        {
          label: t('deploymentSwitcher.later'),
          onClick: () => toast.close(noticeId)
        }
      ]
    })
  }

  const changeKey = computed(() => {
    const change = changeSinceBoot.value
    if (change === null || !toValue(active)) return null
    const now = pickedDeployment.value
    return `${change}:${now?.deployment_id ?? ''}:${now?.release_id ?? ''}`
  })

  watch(changeKey, (key, previous) => {
    if (key === previous) return
    if (key === null) {
      toast.dismiss(noticeId)
      return
    }
    const change = changeSinceBoot.value
    if (change !== null) showNotice(change)
  })

  return isWatching
}
