import { tryOnScopeDispose, watchDebounced } from '@vueuse/core'
import { shallowRef } from 'vue'

import type { PaparazziFace } from './usePaparazziMe'
import { paparazziRequest } from '../lib/workshop/paparazzi-me/contract'
import { faceCrop } from '../lib/workshop/paparazzi-me/mock-run'
import { renderPaparazziPreview } from '../lib/workshop/paparazzi-me/render'
import type { PaparazziSetup } from '../lib/workshop/paparazzi-me/setup'

/**
 * The composition before the run, redrawn when the face or the setup
 * changes. Undefined until drawn, or where the canvas is missing.
 */
export function usePaparazziPreview(
  face: () => PaparazziFace | undefined,
  setup: () => PaparazziSetup
) {
  const url = shallowRef<string>()
  let ticket = 0

  function show(next: string | undefined) {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = next
  }

  watchDebounced(
    [face, setup],
    async ([current, chosen]) => {
      ticket += 1
      const mine = ticket
      const request = paparazziRequest(current?.url ?? '', chosen)
      const drawn = await renderPaparazziPreview(
        request,
        current ? faceCrop(current.url) : undefined
      ).catch(() => undefined)
      if (mine === ticket) show(drawn)
      else if (drawn) URL.revokeObjectURL(drawn)
    },
    { debounce: 120, immediate: true }
  )

  tryOnScopeDispose(() => {
    ticket += 1
    show(undefined)
  })

  return url
}
