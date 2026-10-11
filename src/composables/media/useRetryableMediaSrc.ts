import { useTimeoutFn } from '@vueuse/core'
import { nextTick, readonly, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export type MediaSrcStatus = 'idle' | 'loading' | 'retrying' | 'failed'

const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000] as const

export function useRetryableMediaSrc(
  source: MaybeRefOrGetter<string | undefined>
) {
  const src = ref<string | undefined>()
  const status = ref<MediaSrcStatus>('idle')
  let retriesUsed = 0
  let generation = 0
  const nextDelay = ref<number>(RETRY_DELAYS_MS[0])

  const reload = async () => {
    const gen = ++generation
    src.value = undefined
    await nextTick()
    if (gen !== generation) return
    src.value = toValue(source)
    status.value = 'loading'
  }

  const { start, stop } = useTimeoutFn(reload, nextDelay, {
    immediate: false
  })

  const bind = (url: string | undefined) => {
    stop()
    generation++
    retriesUsed = 0
    src.value = url
    status.value = url ? 'loading' : 'idle'
  }

  const onError = () => {
    if (status.value !== 'loading') return

    if (retriesUsed >= RETRY_DELAYS_MS.length) {
      status.value = 'failed'
      return
    }

    nextDelay.value = RETRY_DELAYS_MS[retriesUsed]
    retriesUsed++
    status.value = 'retrying'
    start()
  }

  const retry = () => {
    if (status.value === 'idle') return

    stop()
    retriesUsed = 0
    status.value = 'retrying'
    void reload()
  }

  watch(() => toValue(source), bind, { immediate: true, flush: 'sync' })

  return {
    src: readonly(src),
    status: readonly(status),
    onError,
    retry
  }
}
