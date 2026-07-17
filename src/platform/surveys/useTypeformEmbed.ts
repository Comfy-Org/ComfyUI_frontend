import { whenever } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, ref, toValue } from 'vue'

import { createScriptLoader } from '@/utils/loadExternalScript'

const TYPEFORM_SRC = 'https://embed.typeform.com/next/embed.js'
const VALID_ID_PATTERN = /^[A-Za-z0-9]+$/

interface TypeformGlobal {
  load?: () => void
}

declare global {
  interface Window {
    tf?: TypeformGlobal
  }
}

/** Pure validator for Typeform form IDs. Exported so feature sites can
 *  gate rendering before mounting the embed container. */
export function isTypeformIdValid(id: string | undefined | null): boolean {
  return !!id && VALID_ID_PATTERN.test(id)
}

const loadTypeformScript = createScriptLoader(TYPEFORM_SRC, () =>
  typeof window.tf?.load === 'function' ? (window.tf as TypeformGlobal) : null
)

function ensureScriptLoaded(): Promise<TypeformGlobal> {
  return loadTypeformScript()
}

/**
 * Loads the Typeform embed script on first consumer mount and exposes
 * validation + error state for an inline form container. After the
 * script is ready, `window.tf.load()` is called each time a new
 * container appears so Typeform re-scans for the new `data-tf-widget`
 * element — the embed's DOMContentLoaded auto-scan only runs once and
 * its MutationObserver does not reliably catch elements added by later
 * consumers (e.g. a second popover opening later in the session).
 * `load()` with `forceReload: false` is idempotent for already-
 * initialized elements.
 */
export function useTypeformEmbed(
  typeformRef: Ref<HTMLElement | null>,
  typeformIdInput: MaybeRefOrGetter<string | undefined>
) {
  const typeformError = ref(false)

  const isValidTypeformId = computed(() =>
    isTypeformIdValid(toValue(typeformIdInput))
  )

  whenever(typeformRef, async () => {
    try {
      await ensureScriptLoaded()
      const tf = window.tf
      if (typeof tf?.load !== 'function') {
        throw new Error('Typeform API unavailable after script load')
      }
      tf.load()
    } catch (err) {
      console.error('[useTypeformEmbed]', err)
      typeformError.value = true
    }
  })

  return {
    typeformError,
    isValidTypeformId
  }
}
