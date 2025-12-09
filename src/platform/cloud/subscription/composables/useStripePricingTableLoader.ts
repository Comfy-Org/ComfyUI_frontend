import { createSharedComposable } from '@vueuse/core'
import { ref } from 'vue'

import { STRIPE_PRICING_TABLE_SCRIPT_SRC } from '@/config/stripePricingTableConfig'

function useStripePricingTableLoaderInternal() {
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  let pendingPromise: Promise<void> | null = null

  const resolveLoaded = () => {
    isLoaded.value = true
    isLoading.value = false
    pendingPromise = null
  }

  const resolveError = (err: Error) => {
    error.value = err
    isLoading.value = false
    pendingPromise = null
  }

  const loadScript = (): Promise<void> => {
    if (isLoaded.value) {
      return Promise.resolve()
    }

    if (pendingPromise) {
      return pendingPromise
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${STRIPE_PRICING_TABLE_SCRIPT_SRC}"]`
    )

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolveLoaded()
        return Promise.resolve()
      }

      pendingPromise = new Promise<void>((resolve, reject) => {
        existingScript.addEventListener(
          'load',
          () => {
            existingScript.dataset.loaded = 'true'
            resolveLoaded()
            resolve()
          },
          { once: true }
        )
        existingScript.addEventListener(
          'error',
          () => {
            const err = new Error('Stripe pricing table script failed to load')
            resolveError(err)
            reject(err)
          },
          { once: true }
        )
      })

      return pendingPromise
    }

    isLoading.value = true
    pendingPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = STRIPE_PRICING_TABLE_SCRIPT_SRC
      script.async = true
      script.dataset.loaded = 'false'

      script.addEventListener(
        'load',
        () => {
          script.dataset.loaded = 'true'
          resolveLoaded()
          resolve()
        },
        { once: true }
      )

      script.addEventListener(
        'error',
        () => {
          const err = new Error('Stripe pricing table script failed to load')
          resolveError(err)
          reject(err)
        },
        { once: true }
      )

      document.head.appendChild(script)
    })

    return pendingPromise
  }

  return {
    loadScript,
    isLoaded,
    isLoading,
    error
  }
}

export const useStripePricingTableLoader = createSharedComposable(
  useStripePricingTableLoaderInternal
)
