import { whenever } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, ref, toValue } from 'vue'

const TYPEFORM_SRC = 'https://embed.typeform.com/next/embed.js'
const VALID_ID_PATTERN = /^[A-Za-z0-9]+$/
const SCRIPT_LOAD_TIMEOUT_MS = 10_000

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

/**
 * Module-level singleton so every consumer shares one script load.
 * Resets to `null` on failure so a later consumer can retry.
 */
let scriptPromise: Promise<void> | null = null

function ensureScriptLoaded(): Promise<void> {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TYPEFORM_SRC}"]`
    )

    if (existing && typeof window.tf?.load === 'function') {
      resolve()
      return
    }

    const scriptEl = existing ?? document.createElement('script')

    const timeoutId = window.setTimeout(() => {
      scriptEl.remove()
      scriptPromise = null
      reject(new Error('Typeform embed script load timed out'))
    }, SCRIPT_LOAD_TIMEOUT_MS)

    scriptEl.addEventListener(
      'load',
      () => {
        window.clearTimeout(timeoutId)
        resolve()
      },
      { once: true }
    )
    scriptEl.addEventListener(
      'error',
      () => {
        window.clearTimeout(timeoutId)
        scriptEl.remove()
        scriptPromise = null
        reject(new Error('Typeform embed script failed to load'))
      },
      { once: true }
    )

    if (!existing) {
      scriptEl.src = TYPEFORM_SRC
      scriptEl.async = true
      document.head.appendChild(scriptEl)
    }
  })

  return scriptPromise
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

  const typeformId = computed(() =>
    isValidTypeformId.value ? (toValue(typeformIdInput) ?? '') : ''
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
    isValidTypeformId,
    typeformId
  }
}
