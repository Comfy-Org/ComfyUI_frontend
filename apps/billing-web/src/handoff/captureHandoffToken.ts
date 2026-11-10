/** Where a tab keeps its billing handoff; shared with the app so the capture can write before anything loads. */
export const HANDOFF_STORAGE_KEY = 'comfy.billing-web.handoff.v1'

const EXCHANGE_LOST = JSON.stringify({ kind: 'ended', ending: 'exchange_lost' })

export interface CaptureLocation {
  readonly pathname: string
  readonly search: string
  readonly hash: () => string
  readonly replaceUrl: (url: string) => void
  /** Replaces any earlier handoff before the first await, so a reload mid-load cannot restore it. */
  readonly markExchangePending: (marker: string) => void
}

export type HandoffCapture =
  | { readonly kind: 'halt' }
  | {
      readonly kind: 'captured'
      readonly onHandoffPath: boolean
      readonly token: string | undefined
    }

/** True for a fragment that may carry a handoff token, on any route. */
export function fragmentCarriesToken(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, '')).has('token')
}

/** Takes the handoff token out of the URL before anything else on the page runs; dependency-free on purpose. */
export function captureHandoffToken(location: CaptureLocation): HandoffCapture {
  const fragment = location.hash()
  const onHandoffPath = /^\/handoff\/?$/.test(location.pathname)
  const token = onHandoffPath
    ? (new URLSearchParams(fragment.replace(/^#/, '')).get('token') ??
      undefined)
    : undefined
  if (fragmentCarriesToken(fragment) || (onHandoffPath && fragment !== '')) {
    location.replaceUrl(`${location.pathname}${location.search}`)
    if (location.hash() !== '') return { kind: 'halt' }
  }
  if (token) location.markExchangePending(EXCHANGE_LOST)
  return {
    kind: 'captured',
    onHandoffPath,
    token: token === '' ? undefined : token
  }
}
