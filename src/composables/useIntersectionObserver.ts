import { onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  immediate?: boolean
}

export function useIntersectionObserver(
  target: Ref<Element | null>,
  callback: IntersectionObserverCallback,
  options: UseIntersectionObserverOptions = {}
) {
  const { immediate = true, ...observerOptions } = options

  const isSupported =
    typeof window !== 'undefined' && 'IntersectionObserver' in window
  const isIntersecting = ref(false)

  let observer: IntersectionObserver | null = null

  function cleanup() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  function observe() {
    cleanup()

    if (!isSupported || !target.value) return

    observer = new IntersectionObserver((entries) => {
      isIntersecting.value = entries.some((entry) => entry.isIntersecting)
      callback(entries, observer!)
    }, observerOptions)

    observer.observe(target.value)
  }

  function unobserve() {
    if (observer && target.value) {
      observer.unobserve(target.value)
    }
  }

  if (immediate) {
    watch(target, observe, { immediate: true, flush: 'post' })
  }

  onBeforeUnmount(cleanup)

  return {
    isSupported,
    isIntersecting,
    observe,
    unobserve,
    cleanup
  }
}
