import { useEventListener } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import { COMPARE_HASH, MIN_COMPARED, toggleCompared } from './compare'

export function useCompareSelection(models: () => readonly WorkshopModel[]) {
  const slugs = ref<readonly string[]>([])
  const open = ref(false)

  const chosen = computed(() =>
    slugs.value.flatMap(
      (slug) => models().find((model) => model.slug === slug) ?? []
    )
  )
  const ready = computed(() => chosen.value.length >= MIN_COMPARED)

  function openFromAddress() {
    if (location.hash === COMPARE_HASH && ready.value) open.value = true
  }

  function writeAddress(on: boolean) {
    const hash = on ? COMPARE_HASH : ''
    if (location.hash === hash) return
    history.replaceState(
      history.state,
      '',
      `${location.pathname}${location.search}${hash}`
    )
  }

  onMounted(openFromAddress)
  useEventListener(window, 'hashchange', openFromAddress)
  watch(open, writeAddress)
  watch(ready, (value) => {
    if (!value) open.value = false
  })

  return {
    slugs,
    chosen,
    ready,
    open,
    toggle: (slug: string) => {
      slugs.value = toggleCompared(slugs.value, slug)
    },
    clear: () => {
      slugs.value = []
    }
  }
}
