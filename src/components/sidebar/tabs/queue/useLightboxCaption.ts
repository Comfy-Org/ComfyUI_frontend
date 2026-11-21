import { computed, onBeforeUnmount, ref, watch } from 'vue'

type CaptionState = 'hidden' | 'waiting' | 'shown' | 'pinned'

const HIDE_DELAY_MS = 2000

export function useLightboxCaption(isReady: () => boolean) {
  const state = ref<CaptionState>('hidden')
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const visible = computed(
    () => state.value === 'shown' || state.value === 'pinned'
  )

  function clearHideTimer() {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }

  function showTransient() {
    state.value = 'shown'
    clearHideTimer()
    hideTimer = setTimeout(() => {
      state.value = 'hidden'
    }, HIDE_DELAY_MS)
  }

  function reveal() {
    if (!isReady()) {
      state.value = 'waiting'
      return
    }
    showTransient()
  }

  function hide() {
    clearHideTimer()
    state.value = 'hidden'
  }

  function pin() {
    clearHideTimer()
    state.value = 'pinned'
  }

  function unpin() {
    state.value = 'hidden'
  }

  watch(isReady, (ready) => {
    if (ready && state.value === 'waiting') showTransient()
  })

  onBeforeUnmount(clearHideTimer)

  return { visible, reveal, hide, pin, unpin }
}
