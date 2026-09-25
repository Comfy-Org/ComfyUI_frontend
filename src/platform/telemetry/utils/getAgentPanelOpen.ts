/**
 * Whether the agent panel is open at the moment a run is submitted.
 *
 * Reads the key `useAgentPanelStore` persists `isOpen` to rather than the store
 * itself: this util is consumed from `platform/`, which the layer architecture
 * forbids from importing `workbench/`. Same trade-off as
 * `getActionbarDockState`, whose key is likewise duplicated from its writer.
 *
 * `isOpen` is the user's stored preference, not the store's `isVisible` — the
 * latter also folds in the feature gate and consent, which would make the flag
 * incomparable across users.
 */
export function getAgentPanelOpen(): boolean {
  try {
    return localStorage.getItem('Comfy.AgentPanel.open') === 'true'
  } catch {
    return false
  }
}
