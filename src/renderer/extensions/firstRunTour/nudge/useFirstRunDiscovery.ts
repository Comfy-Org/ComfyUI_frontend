import { computed, onScopeDispose, readonly, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import type { ResultItem } from '@/schemas/apiSchema'

import {
  DISCOVERY_APPEAR_DELAY_MS,
  DISCOVERY_CATALOG_WAIT_MS,
  transitionDiscovery
} from './firstRunDiscovery'
import type { DiscoveryEvent, DiscoveryState } from './firstRunDiscovery'
import type { Suggestion } from './firstRunSuggestions'

export function useFirstRunDiscovery(options: {
  armed: Readonly<Ref<boolean>>
  completedAt: Readonly<Ref<number | null>>
  output: Readonly<Ref<ResultItem | null>>
  screenClear: Readonly<Ref<boolean>>
  catalogSuggestions: Readonly<Ref<Suggestion[]>>
  loadCatalog: () => Promise<unknown>
  onShown: (suggestions: Suggestion[]) => void
}) {
  const state = shallowRef<DiscoveryState>({ phase: 'dormant' })
  let generation = 0
  let catalogTimer: ReturnType<typeof setTimeout> | undefined
  let appearanceTimer: ReturnType<typeof setTimeout> | undefined

  function dispatch(event: DiscoveryEvent) {
    const previous = state.value
    state.value = transitionDiscovery(previous, event, Date.now())
    if (previous.phase !== 'shown' && state.value.phase === 'shown')
      options.onShown(state.value.suggestions)
  }

  function reset() {
    generation++
    clearTimeout(catalogTimer)
    clearTimeout(appearanceTimer)
    dispatch({ type: 'reset' })
  }

  function startCatalog() {
    const current = generation
    const settle = () => {
      if (current !== generation) return
      clearTimeout(catalogTimer)
      dispatch({
        type: 'catalog-settled',
        suggestions: options.catalogSuggestions.value
      })
    }
    catalogTimer = setTimeout(settle, DISCOVERY_CATALOG_WAIT_MS)
    void options.loadCatalog().then(settle, settle)
  }

  watch(
    [options.armed, options.completedAt, options.output, options.screenClear],
    ([armed, completedAt, output, screenClear]) => {
      if (!armed) {
        reset()
        return
      }
      const starting = state.value.phase === 'dormant'
      if (starting)
        dispatch({ type: 'tour-ended', completedAt, output, screenClear })
      else
        dispatch({ type: 'context-changed', completedAt, output, screenClear })
      clearTimeout(appearanceTimer)
      if (state.value.phase === 'waiting' && completedAt !== null)
        appearanceTimer = setTimeout(
          () => dispatch({ type: 'appearance-due' }),
          Math.max(0, completedAt + DISCOVERY_APPEAR_DELAY_MS - Date.now())
        )
      if (starting) startCatalog()
    },
    { immediate: true }
  )
  onScopeDispose(reset)

  return {
    state: readonly(state),
    onScreen: computed(
      () => state.value.phase === 'shown' && state.value.screenClear
    )
  }
}
