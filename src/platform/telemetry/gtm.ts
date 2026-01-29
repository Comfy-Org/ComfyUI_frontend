import { isCloud } from '@/platform/distribution/types'

const GTM_CONTAINER_ID = 'GTM-NP9JM6K7'

let isInitialized = false
let initPromise: Promise<void> | null = null

export function initGtm(): void {
  if (!isCloud || typeof window === 'undefined') return
  if (typeof document === 'undefined') return
  if (isInitialized) return

  if (!initPromise) {
    initPromise = new Promise((resolve) => {
      const dataLayer = window.dataLayer ?? (window.dataLayer = [])
      dataLayer.push({
        'gtm.start': Date.now(),
        event: 'gtm.js'
      })

      const script = document.createElement('script')
      script.async = true
      script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`

      const finalize = () => {
        isInitialized = true
        resolve()
      }

      script.addEventListener('load', finalize, { once: true })
      script.addEventListener('error', finalize, { once: true })
      document.head?.appendChild(script)
    })
  }

  void initPromise
}

export function pushDataLayerEvent(event: Record<string, unknown>): void {
  if (!isCloud || typeof window === 'undefined') return
  const dataLayer = window.dataLayer ?? (window.dataLayer = [])
  dataLayer.push(event)
}
