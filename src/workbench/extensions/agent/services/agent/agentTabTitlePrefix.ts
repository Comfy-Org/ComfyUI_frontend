import { reportError } from '@comfyorg/telemetry/reportError'

import { useBrowserTabTitleStore } from '@/stores/browserTabTitleStore'

const AGENT_TAB_TITLE_SOURCE = 'agent'

let releaseHold: (() => void) | undefined

function setDesktopAttentionNeeded(needed: boolean): void {
  try {
    window.__comfyDesktop2?.setAttentionNeeded?.(needed)
  } catch (error) {
    reportError(error, {
      surface: 'agent',
      errorType: 'failure_setting_desktop_attention',
      level: 'warning'
    })
  }
}

function applyPrefix(text: string | null | undefined): void {
  useBrowserTabTitleStore().setPrefix(AGENT_TAB_TITLE_SOURCE, text)
  setDesktopAttentionNeeded(Boolean(text))
}

function endHold(): void {
  const release = releaseHold
  releaseHold = undefined
  release?.()
}

/** Sets the agent's browser tab title prefix; an empty value clears it. Ends any hold. */
export function setAgentTabTitlePrefix(text: string | null | undefined): void {
  endHold()
  applyPrefix(text)
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
  const clear = () => {
    endHold()
    applyPrefix(null)
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
