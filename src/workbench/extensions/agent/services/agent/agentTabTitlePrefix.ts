import { useBrowserTabTitleStore } from '@/stores/browserTabTitleStore'

const AGENT_TAB_TITLE_SOURCE = 'agent'

/** Sets the agent's browser tab title prefix; an empty value clears it. */
export function setAgentTabTitlePrefix(text: string | null | undefined): void {
  useBrowserTabTitleStore().setPrefix(AGENT_TAB_TITLE_SOURCE, text)
}
