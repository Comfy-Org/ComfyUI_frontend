import {
  useDocumentVisibility,
  useElementVisibility,
  usePreferredReducedMotion
} from '@vueuse/core'
import { computed, onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'

export function usePreviewVideo(video: Readonly<Ref<HTMLVideoElement | null>>) {
  const onScreen = useElementVisibility(video, { initialValue: false })
  const visibility = useDocumentVisibility()
  const motionPreference = usePreferredReducedMotion()
  const loadVideo = computed(
    () => onScreen.value && visibility.value === 'visible'
  )

  watch(
    [video, loadVideo, motionPreference],
    ([element, load, motion]) => {
      if (!element) return
      if (load && motion !== 'reduce') void element.play().catch(() => {})
      else element.pause()
      if (!load) element.load()
    },
    { flush: 'post' }
  )

  onBeforeUnmount(() => {
    video.value?.pause()
    video.value?.removeAttribute('src')
    video.value?.load()
  })

  return loadVideo
}
