import type { Analytics } from '@customerio/cdp-analytics-browser'

import type { Locale } from '@/i18n/translations'

// Public client-side key for the "comfy.org website" Customer.io source,
// overridable per-environment; setting the env var to '' disables the form.
const CUSTOMER_IO_WEBSITE_WRITE_KEY: string =
  import.meta.env.PUBLIC_CUSTOMERIO_WRITE_KEY ?? '77380595dd956c04ac7c'

export const isDownloadLinkRequestEnabled = CUSTOMER_IO_WEBSITE_WRITE_KEY !== ''

let analyticsPromise: Promise<Analytics> | null = null

function loadAnalytics(): Promise<Analytics> {
  analyticsPromise ??= import('@customerio/cdp-analytics-browser')
    .then(async ({ AnalyticsBrowser }) => {
      const [analytics] = await AnalyticsBrowser.load({
        writeKey: CUSTOMER_IO_WEBSITE_WRITE_KEY
      })
      return analytics
    })
    .catch((err: unknown) => {
      // Don't cache failures - let the next call retry the load.
      analyticsPromise = null
      throw err
    })
  return analyticsPromise
}

export function preloadDownloadLinkAnalytics() {
  if (!isDownloadLinkRequestEnabled) return
  // Preload is best-effort; a failure here will be retried on submit.
  void loadAnalytics().catch(() => {})
}

export async function requestDownloadLink(email: string, locale: Locale) {
  const analytics = await loadAnalytics()
  await analytics.identify(email, { email })
  await analytics.track('download_link_requested', {
    locale,
    page: window.location.pathname
  })
}
