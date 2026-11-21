import { safeLocalStorage } from '@/base/storage/safeStorage'

/** Last persisted `useAgentPanelStore` open preference; the key is shared across windows. */
export function getAgentPanelOpen(): boolean {
  return safeLocalStorage.getItem('Comfy.AgentPanel.open') === 'true'
}
