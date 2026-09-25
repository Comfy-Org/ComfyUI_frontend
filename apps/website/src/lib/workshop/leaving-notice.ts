const KEY = 'comfy-workshop-leaving-notice'

/**
 * Whether a reader still has to be told that a generation survives them leaving
 * the page. It is news exactly once: after that they know how it works, and
 * asking again on every link would be in the way of the thing they came to do.
 * Per tab, because a new tab is a new reader as far as this page can tell.
 */
export function leavingNoticeUnseen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === null
  } catch {
    return false
  }
}

export function markLeavingNoticeSeen(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // A reader who blocked storage gets told every time rather than never.
  }
}
