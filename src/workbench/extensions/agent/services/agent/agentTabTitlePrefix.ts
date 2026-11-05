import { useBrowserTabTitleStore } from '@/stores/browserTabTitleStore'

const AGENT_TAB_TITLE_SOURCE = 'agent'

let releaseHold: (() => void) | undefined

function endHold(): void {
  const release = releaseHold
  releaseHold = undefined
  release?.()
}

/** Sets the agent's browser tab title prefix; an empty value clears it. Ends any hold. */
export function setAgentTabTitlePrefix(text: string | null | undefined): void {
  endHold()
  useBrowserTabTitleStore().setPrefix(AGENT_TAB_TITLE_SOURCE, text)
}

/**
 * Keeps the current prefix after its owner is gone. It clears at `deadline`
 * (epoch ms) or when `clearOn` fires, and the next
 * {@link setAgentTabTitlePrefix} takes over without clearing.
 */
export function holdAgentTabTitlePrefixUntil(
  deadline: number,
  clearOn?: (listener: () => void) => () => void
): void {
  endHold()
  const store = useBrowserTabTitleStore()
  const clear = () => {
    endHold()
    store.setPrefix(AGENT_TAB_TITLE_SOURCE, null)
  }
  const remaining = deadline - Date.now()
  if (remaining <= 0) {
    clear()
    return
  }
  const timer = setTimeout(clear, remaining)
  const unsubscribe = clearOn?.(clear)
  releaseHold = () => {
    clearTimeout(timer)
    unsubscribe?.()
  }
}
