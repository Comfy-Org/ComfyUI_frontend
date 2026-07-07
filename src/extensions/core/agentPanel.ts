import {
  createAgentRestClient,
  createPostHogFlagSource,
  createWebSocketEventSource,
  mountAgentPanel
} from '@comfyorg/agent-panel'
import type { AgentPanelHandle } from '@comfyorg/agent-panel'

import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

/**
 * In-App Agent panel (FE-1187): registers the agent side panel as a sidebar tab,
 * gated by the PostHog flag `agent-in-app-experience`. Fail-closed: the tab is not
 * registered until the flag evaluates true, and it unregisters if the flag turns off.
 * The panel itself ships as the @comfyorg/agent-panel workspace package and mounts as
 * its own Vue app inside the tab (type 'custom'), keeping its vue-i18n major and
 * pinia instance isolated from the host.
 */

const TAB_ID = 'agent-panel'

let handle: AgentPanelHandle | null = null

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    // Host store instances are captured HERE, in host app context: pinia's active
    // instance is a module-level global that the panel's own pinia also sets, so a
    // lazy useXStore() inside a callback could resolve against the wrong instance.
    const sidebarTabStore = useSidebarTabStore()
    const workspaceAuthStore = useWorkspaceAuthStore()

    function render(container: HTMLElement): void {
      const socket = api.socket
      if (!socket) {
        // The host socket connects during boot; a null here means the tab opened
        // impossibly early. Fail visibly in dev rather than mounting a deaf panel.
        console.warn('[agent-panel] host /ws socket not connected yet')
        return
      }
      handle = mountAgentPanel(container, {
        deps: {
          rest: createAgentRestClient({
            getAuthToken: () => workspaceAuthStore.workspaceToken ?? undefined
          }),
          // The host /ws carries the agent_* broadcasts; the panel filters them.
          // TODO(FE-1187): the adapter binds THIS socket instance, so an api
          // reconnect (which replaces api.socket) leaves the panel deaf until the
          // tab remounts; also confirm agent_* message types reach raw socket
          // listeners rather than being swallowed by the api dispatcher.
          events: createWebSocketEventSource(socket)
          // TODO(FE-1187): workflowId provider (binds the agent draft to the active
          // cloud workflow) once the id surface is confirmed; chat works without it.
        },
        // V0 draft apply is a full-graph load per the tech design (no incremental
        // edits). The draft rides the wire untyped; parse it through the host's own
        // workflow schema instead of blind-casting.
        applyDraft: (content) => {
          void (async () => {
            const workflow = await validateComfyWorkflow(content)
            if (workflow) await app.loadGraphData(workflow)
          })()
        }
      })
    }

    function destroy(): void {
      handle?.unmount()
      handle = null
    }

    async function setupFlagGate(): Promise<void> {
      // posthog-js is initialized (or not) by the telemetry provider; an
      // uninitialized client answers isFeatureEnabled with undefined, which the
      // flag source maps to false, so the gate stays closed by default.
      const posthog = (await import('posthog-js')).default
      const source = createPostHogFlagSource(posthog)
      let registered = false
      const sync = (): void => {
        const enabled = source.isEnabled()
        if (enabled && !registered) {
          sidebarTabStore.registerSidebarTab({
            id: TAB_ID,
            type: 'custom',
            icon: 'icon-[lucide--sparkles]',
            title: 'sideToolbar.agentPanel',
            tooltip: 'sideToolbar.agentPanel',
            label: 'sideToolbar.labels.agentPanel',
            render,
            destroy
          })
          registered = true
        } else if (!enabled && registered) {
          sidebarTabStore.unregisterSidebarTab(TAB_ID)
          registered = false
        }
      }
      source.onChange?.(sync)
      sync()
    }

    void setupFlagGate()
  }
})
