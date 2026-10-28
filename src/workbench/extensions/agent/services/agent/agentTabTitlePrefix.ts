import { useBrowserTabTitleStore } from '@/stores/browserTabTitleStore'

const AGENT_TAB_TITLE_SOURCE = 'agent'

/** Sets or clears (`null`) the agent's browser tab title prefix. */
export function setAgentTabTitlePrefix(text: string | null): void {
  useBrowserTabTitleStore().setPrefix(AGENT_TAB_TITLE_SOURCE, text)
}
