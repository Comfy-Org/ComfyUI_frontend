import { useBrowserTabTitleStore } from '@/stores/browserTabTitleStore'

const AGENT_TAB_TITLE_SOURCE = 'agent'

let heldUntil: ReturnType<typeof setTimeout> | undefined

function releaseHold(): void {
  clearTimeout(heldUntil)
  heldUntil = undefined
}

/** Sets the agent's browser tab title prefix; an empty value clears it. Ends any hold. */
export function setAgentTabTitlePrefix(text: string | null | undefined): void {
  releaseHold()
  useBrowserTabTitleStore().setPrefix(AGENT_TAB_TITLE_SOURCE, text)
}

/**
 * Keeps the current prefix after its owner is gone, until `deadline` (epoch ms)
 * or the next {@link setAgentTabTitlePrefix}, whichever comes first.
 */
export function holdAgentTabTitlePrefixUntil(deadline: number): void {
  releaseHold()
  const store = useBrowserTabTitleStore()
  const remaining = deadline - Date.now()
  if (remaining <= 0) {
    store.setPrefix(AGENT_TAB_TITLE_SOURCE, null)
    return
  }
  heldUntil = setTimeout(() => {
    heldUntil = undefined
    store.setPrefix(AGENT_TAB_TITLE_SOURCE, null)
  }, remaining)
}
