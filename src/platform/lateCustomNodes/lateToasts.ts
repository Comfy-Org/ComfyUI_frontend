import { useIntervalFn } from '@vueuse/core'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { createToastId } from '@/types/toastId'

function packNameOf(ext: string): string {
  const match = /^\/?extensions\/([^/]+)\//.exec(ext)
  return match ? match[1] : ext
}

function packsOf(scripts: Iterable<string>): string {
  return [...new Set([...scripts].map(packNameOf))].join(', ')
}

/** Shows the seconds since `startedAt` and the packs still in `waiting`, kept current every second until dismissed. */
export function showStartingToast(
  startedAt: number,
  waiting: ReadonlySet<string>
) {
  const toast = useToast()
  const id = createToastId()
  function text() {
    const packs = packsOf(waiting)
    return {
      title: t('lateCustomNodes.starting', {
        seconds: Math.round((Date.now() - startedAt) / 1000)
      }),
      description: [
        t('lateCustomNodes.startingDetail'),
        packs ? t('lateCustomNodes.waitingFor', { packs }) : ''
      ]
        .filter(Boolean)
        .join(' ')
    }
  }
  const first = text()
  toast.loading(first.title, {
    id,
    description: first.description,
    closable: false
  })
  function refresh() {
    toast.update(id, text())
  }
  const ticker = useIntervalFn(refresh, 1000)
  return {
    refresh,
    dismiss: () => {
      ticker.pause()
      toast.dismiss(id)
    }
  }
}

export function showReadyToast() {
  useToast().info(t('lateCustomNodes.ready'), { duration: 5000 })
}

/** Names the packs that did not start, with a Reload action. */
export function showFailedToast(scripts: string[]) {
  useToast().warning(t('lateCustomNodes.failed'), {
    description: t('lateCustomNodes.failedDetail', { packs: packsOf(scripts) }),
    action: {
      label: t('lateCustomNodes.reload'),
      onClick: () => window.location.reload()
    }
  })
}
