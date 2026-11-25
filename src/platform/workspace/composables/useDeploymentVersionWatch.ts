import {
  useDocumentVisibility,
  useEventListener,
  useIntervalFn
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, effectScope, toValue, watch } from 'vue'
import type { EffectScope, MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import {
  DEPLOYMENT_VERSION_FOCUS_GAP_MS,
  DEPLOYMENT_VERSION_WATCH_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import {
  releaseNoticeId,
  useReleaseNoticeStore
} from '@/platform/workspace/stores/releaseNoticeStore'

const NOTICE_OWNER = 'deploymentVersionWatch'
let settledKey: string | null = null
let dismissedKey: string | null = null
let noticeScope: EffectScope | undefined

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
  const releaseNotices = useReleaseNoticeStore()

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

  function dismissOwnNotice() {
    if (releaseNotices.isShownBy(NOTICE_OWNER)) toast.dismiss(releaseNoticeId)
  }

  function showNotice(change: 'release' | 'deployment', key: string) {
    releaseNotices.markShown(NOTICE_OWNER)
    toast.info(noticeTitle(change), {
      id: releaseNoticeId,
      actions: [
        { label: t('deploymentSwitcher.reload'), onClick: reload },
        {
          label: t('deploymentSwitcher.later'),
          onClick: () => {
            dismissedKey = key
            toast.close(releaseNoticeId)
          }
        }
      ]
    })
  }

  function mayTellOfRelease(): boolean {
    const release = pickedDeployment.value?.release_id
    return release === undefined || releaseNotices.claim(release, NOTICE_OWNER)
  }

  function changeKey(): string | null {
    const change = changeSinceBoot.value
    if (change === null) return null
    const now = pickedDeployment.value
    return `${change}:${now?.deployment_id ?? ''}:${now?.release_id ?? ''}`
  }

  function shownKey(): string | null {
    return toValue(active) ? changeKey() : null
  }

  function forgetDismissalOnNewChange(key: string | null) {
    if (key !== dismissedKey) dismissedKey = null
  }

  function settleNotice(key: string | null) {
    if (key === settledKey) return
    settledKey = key
    const change = changeSinceBoot.value
    if (key === null || change === null || key === dismissedKey) {
      dismissOwnNotice()
      return
    }
    if (change === 'release' && !mayTellOfRelease()) {
      dismissOwnNotice()
      return
    }
    showNotice(change, key)
  }

  noticeScope?.stop()
  noticeScope = effectScope(true)
  noticeScope.run(() => {
    watch(changeKey, forgetDismissalOnNewChange, { immediate: true })
    watch(shownKey, settleNotice, { immediate: true })
  })

  return isWatching
}
