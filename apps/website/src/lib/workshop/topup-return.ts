const RETURN_PARAM = 'workshopTopUpReturn'
const MESSAGE_TYPE = 'workshop-topup-return'
const CHANNEL_NAME = 'comfy-workshop-topup'
const STORAGE_KEY = 'comfy-workshop-topup-return'
const ATTEMPT_ID = /^[A-Za-z0-9_-]{1,64}$/

interface TopUpReturnMessage {
  readonly type: typeof MESSAGE_TYPE
  readonly attemptId: string
}

function parseMessage(value: unknown): TopUpReturnMessage | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (!('type' in value) || !('attemptId' in value)) return undefined
  return value.type === MESSAGE_TYPE &&
    typeof value.attemptId === 'string' &&
    ATTEMPT_ID.test(value.attemptId)
    ? { type: MESSAGE_TYPE, attemptId: value.attemptId }
    : undefined
}

export function topUpReturnUrl(currentHref: string, attemptId: string): string {
  if (!ATTEMPT_ID.test(attemptId)) throw new Error('Invalid checkout attempt')
  const url = new URL(currentHref)
  url.searchParams.set(RETURN_PARAM, attemptId)
  return url.toString()
}

/**
 * A completed and a cancelled Stripe session return to the same URL. The
 * return therefore announces only "the buyer came back"; the opener must
 * observe a real balance increase before it can claim that payment landed.
 */
export function announceTopUpReturnFromLocation(): void {
  const url = new URL(window.location.href)
  const attemptId = url.searchParams.get(RETURN_PARAM)
  if (attemptId === null) return
  url.searchParams.delete(RETURN_PARAM)
  window.history.replaceState(
    window.history.state,
    '',
    url.pathname + url.search + url.hash
  )
  if (!ATTEMPT_ID.test(attemptId)) return

  const message: TopUpReturnMessage = { type: MESSAGE_TYPE, attemptId }
  let sent = false
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin)
      sent = true
      window.opener.focus()
    }
  } catch {
    sent = false
  }
  if (!sent && typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME)
      channel.postMessage(message)
      channel.close()
      sent = true
    } catch {
      sent = false
    }
  }
  if (!sent) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message))
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // The original tab still refreshes its balance when it regains focus.
    }
  }
  window.close()
}

export function subscribeToTopUpReturns(
  listener: (attemptId: string) => void
): () => void {
  const onWindowMessage = (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin) return
    const message = parseMessage(event.data)
    if (message) listener(message.attemptId)
  }
  window.addEventListener('message', onWindowMessage)

  let channel: BroadcastChannel | undefined
  try {
    channel =
      typeof BroadcastChannel === 'undefined'
        ? undefined
        : new BroadcastChannel(CHANNEL_NAME)
  } catch {
    channel = undefined
  }
  const onChannelMessage = (event: MessageEvent<unknown>) => {
    const message = parseMessage(event.data)
    if (message) listener(message.attemptId)
  }
  channel?.addEventListener('message', onChannelMessage)
  const onStorage = (event: StorageEvent) => {
    if (channel || event.key !== STORAGE_KEY || event.newValue === null) return
    let value: unknown
    try {
      value = JSON.parse(event.newValue)
    } catch {
      return
    }
    const message = parseMessage(value)
    if (message) listener(message.attemptId)
  }
  window.addEventListener('storage', onStorage)

  return () => {
    window.removeEventListener('message', onWindowMessage)
    window.removeEventListener('storage', onStorage)
    channel?.removeEventListener('message', onChannelMessage)
    channel?.close()
  }
}
