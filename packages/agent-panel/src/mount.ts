import { createPinia } from 'pinia'
import { createApp } from 'vue'

import HostPanelRoot from './HostPanelRoot.vue'
import type { AgentSessionDeps } from './composables/agent/useAgentSession'
import { i18n } from './i18n'

/**
 * The package's public mount surface. The panel mounts as its OWN Vue app inside a
 * host-provided container: the package's pinia instance and vue-i18n major (v11)
 * stay isolated from the host app (which runs vue-i18n v9), which is what lets the
 * bulk-copied package embed safely before deep integration. Every host dependency
 * flows in through `deps`; the host tears the app down via the returned handle.
 */

export interface MountAgentPanelOptions {
  deps: AgentSessionDeps
  // Applies a newly adopted server draft to the host canvas (V0: full-graph load).
  applyDraft?: (content: Record<string, unknown>, version: number) => void
  userName?: string
}

export interface AgentPanelHandle {
  unmount: () => void
}

export function mountAgentPanel(
  container: HTMLElement,
  options: MountAgentPanelOptions
): AgentPanelHandle {
  // A fresh object literal (not the interface-typed options) satisfies createApp's
  // index-signature rootProps type.
  const app = createApp(HostPanelRoot, {
    deps: options.deps,
    applyDraft: options.applyDraft,
    userName: options.userName
  })
  app.use(createPinia())
  app.use(i18n)
  app.mount(container)
  return { unmount: () => app.unmount() }
}

export {
  AGENT_PANEL_FLAG,
  createPostHogFlagSource,
  useAgentFeatureGate
} from './composables/agent/useAgentFeatureGate'
export type {
  AgentFlagSource,
  PostHogLike
} from './composables/agent/useAgentFeatureGate'
export type {
  AgentEventSource,
  AgentSessionDeps
} from './composables/agent/useAgentSession'
export {
  AgentApiError,
  createAgentRestClient
} from './services/agent/agentRestClient'
export type { AgentRestClient } from './services/agent/agentRestClient'
export { createWebSocketEventSource } from './services/agent/agentEventSource'
export type { EventTargetSocket } from './services/agent/agentEventSource'
