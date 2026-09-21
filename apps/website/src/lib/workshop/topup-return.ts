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

export function topUpReturnUrl(returnHref: string, attemptId: string): string {
  if (!ATTEMPT_ID.test(attemptId)) throw new Error('Invalid checkout attempt')
  const url = new URL(returnHref)
  url.searchParams.set(RETURN_PARAM, attemptId)
  return url.toString()
}

function consumeAttemptId(): string | undefined {
  const url = new URL(window.location.href)
  const attemptId = url.searchParams.get(RETURN_PARAM)
  if (attemptId === null) return undefined
  url.searchParams.delete(RETURN_PARAM)
  window.history.replaceState(
    window.history.state,
    '',
    url.pathname + url.search + url.hash
  )
  return ATTEMPT_ID.test(attemptId) ? attemptId : undefined
}

function sendToOpener(message: TopUpReturnMessage): boolean {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin)
      return true
    }
  } catch {
    return false
  }
  return false
}

function sendToChannel(message: TopUpReturnMessage): boolean {
  if (typeof BroadcastChannel === 'undefined') return false
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(message)
    channel.close()
    return true
  } catch {
    return false
  }
}

function sendToStorage(message: TopUpReturnMessage): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message))
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

export function announceTopUpReturnFromLocation(): void {
  const attemptId = consumeAttemptId()
  if (!attemptId) return
  const message: TopUpReturnMessage = { type: MESSAGE_TYPE, attemptId }
  if (sendToOpener(message) || sendToChannel(message)) return
  sendToStorage(message)
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
