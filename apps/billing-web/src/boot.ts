import {
  HANDOFF_STORAGE_KEY,
  captureHandoffToken,
  fragmentCarriesToken
} from '@/handoff/captureHandoffToken'

function holdsHandoff(): boolean {
  try {
    return window.sessionStorage.getItem(HANDOFF_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

const capture = captureHandoffToken({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: () => window.location.hash,
  replaceUrl: (url) => window.history.replaceState(null, '', url),
  markExchangePending: (marker) => {
    try {
      window.sessionStorage.setItem(HANDOFF_STORAGE_KEY, marker)
    } catch {
      return
    }
  }
})

if (capture.kind === 'captured') {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && holdsHandoff()) window.location.reload()
  })
  window.addEventListener('hashchange', () => {
    if (fragmentCarriesToken(window.location.hash)) window.location.reload()
  })
  void import('@/handoff/startBillingWeb').then(({ startBillingWeb }) =>
    startBillingWeb(capture)
  )
}
