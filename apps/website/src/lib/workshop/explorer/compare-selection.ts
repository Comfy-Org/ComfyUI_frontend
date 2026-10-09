import { useEventListener } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import {
  comparedSearch,
  MIN_COMPARED,
  parseCompared,
  toggleCompared
} from './compare'

/**
 * The models chosen to compare, and whether the compare view is open. An open
 * view names its models in the address, so a reload or a shared link opens
 * the same comparison.
 */
export function useCompareSelection(models: () => readonly WorkshopModel[]) {
  const slugs = ref<readonly string[]>([])
  const open = ref(false)

  const chosen = computed(() =>
    slugs.value.flatMap(
      (slug) => models().find((model) => model.slug === slug) ?? []
    )
  )
  const ready = computed(() => chosen.value.length >= MIN_COMPARED)

  function readAddress() {
    const named = parseCompared(location.search)
    if (!named.length) {
      open.value = false
      return
    }
    slugs.value = named
    open.value = ready.value
  }

  function writeAddress() {
    const search = comparedSearch(
      location.search,
      open.value ? chosen.value.map((model) => model.slug) : []
    )
    if (search === location.search) return
    history.replaceState(
      history.state,
      '',
      `${location.pathname}${search}${location.hash}`
    )
  }

  onMounted(readAddress)
  useEventListener(window, 'popstate', readAddress)
  watch([open, chosen], writeAddress)
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
