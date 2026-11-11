import { computed, shallowRef } from 'vue'

import { useWorkflowTemplateSelectorDialog } from '@/platform/workflow/templates/composables/useWorkflowTemplateSelectorDialog'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import type { WorkflowListItem } from '@/workbench/extensions/agent/components/agent/sidebar/workflowListItem'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { SidebarSection } from '@/workbench/extensions/agent/stores/agent/agentSidebarLayout'

type OpenState =
  | { status: 'idle' }
  | { status: 'opening'; path: string }
  | { status: 'failed'; path: string }

function trackSidebarNav(destination: SidebarSection | 'templates'): void {
  useTelemetry()?.trackUiButtonClicked({
    button_id: `agent_sidebar_nav_${destination}`,
    element_group: 'agent_sidebar_nav'
  })
}

function toWorkflowListItem(workflow: ComfyWorkflow): WorkflowListItem {
  const folder = workflow.directory.slice(ComfyWorkflow.basePath.length)
  return {
    path: workflow.path,
    name: workflow.filename,
    folder: folder === '' ? undefined : folder
  }
}

export function useAgentSidebarLibrary() {
  const agentPanelStore = useAgentPanelStore()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()

  const openState = shallowRef<OpenState>({ status: 'idle' })

  const items = computed((): WorkflowListItem[] => {
    const section = agentPanelStore.sidebarSection
    if (section === 'chats') return []
    return workflowStore.persistedWorkflows
      .filter(
        (workflow) => section === 'workflows' || workflow.suffix === 'app.json'
      )
      .sort((a, b) => b.lastModified - a.lastModified)
      .map(toWorkflowListItem)
  })

  const openingPath = computed(() =>
    openState.value.status === 'opening' ? openState.value.path : null
  )
  const failedPath = computed(() =>
    openState.value.status === 'failed' ? openState.value.path : null
  )

  function refresh(): void {
    void workflowStore.syncWorkflows()
  }

  function showSection(section: SidebarSection): void {
    trackSidebarNav(section)
    const entering = section !== agentPanelStore.sidebarSection
    agentPanelStore.showSidebarSection(section)
    if (!entering) return
    if (openState.value.status === 'failed')
      openState.value = { status: 'idle' }
    if (section !== 'chats') refresh()
  }

  function revealGraph(): void {
    agentPanelStore.dismissSidebarDrawer()
    agentPanelStore.exitFullscreen('graph_reveal')
  }

  function openTemplates(): void {
    trackSidebarNav('templates')
    const workflowBefore = workflowStore.activeWorkflow
    useWorkflowTemplateSelectorDialog().show('agent_sidebar', {
      afterClose: () => {
        if (workflowStore.activeWorkflow !== workflowBefore) revealGraph()
      }
    })
  }

  async function open(path: string): Promise<void> {
    if (openState.value.status === 'opening') return
    const workflow = workflowStore.getWorkflowByPath(path)
    if (!workflow) {
      openState.value = { status: 'failed', path }
      return
    }
    openState.value = { status: 'opening', path }
    try {
      if (!(await workflowService.openWorkflow(workflow))) {
        openState.value = { status: 'failed', path }
        return
      }
    } catch (error) {
      reportError(error, {
        surface: 'agent',
        errorType: 'error_opening_agent_sidebar_workflow'
      })
      openState.value = { status: 'failed', path }
      return
    }
    openState.value = { status: 'idle' }
    revealGraph()
  }

  return {
    items,
    openingPath,
    failedPath,
    refresh,
    showSection,
    openTemplates,
    open
  }
}
