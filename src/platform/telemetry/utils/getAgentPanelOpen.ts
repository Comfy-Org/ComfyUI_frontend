/**
 * The last flushed state of the user's agent-panel preference.
 *
 * Reads the key `useAgentPanelStore` persists `isOpen` to rather than the store
 * itself: this util is consumed from `platform/`, which the layer architecture
 * forbids from importing `workbench/`. Same trade-off as
 * `getActionbarDockState`, whose key is likewise duplicated from its writer.
 *
 * "Last flushed" rather than "open right now": the store persists through
 * `useLocalStorage`, whose write lands on a watcher flush rather than
 * synchronously on assignment, so a toggle in the same tick as a run is not yet
 * visible here.
 *
 * `isOpen` is the user's stored preference, not the store's `isVisible` — the
 * latter also folds in the feature gate and consent, which would make the flag
 * incomparable across users. Two consequences worth knowing when reading this
 * property: a user whose agent feature flag was turned off after they last had
 * the panel open still reports `true`, because `suppressRestoredOpen()` only
 * runs for callers that require `agentPanelStore.enabled`; and the key is
 * origin-wide, so with the panel open in one window a run submitted from
 * another reports the first window's state.
 */
export function getAgentPanelOpen(): boolean {
  try {
    return localStorage.getItem('Comfy.AgentPanel.open') === 'true'
  } catch {
    return false
  }
}
