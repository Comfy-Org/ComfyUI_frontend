import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import {
  showSettingsDialog,
  showTemplateWorkflowsDialog
} from '@/services/dialogService'
import { workflowService } from '@/services/workflowService'
import type { ComfyCommand } from '@/stores/commandStore'
import { useTitleEditorStore } from '@/stores/graphStore'
import { useQueueSettingsStore, useQueueStore } from '@/stores/queueStore'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { type ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { LGraphGroup } from '@comfyorg/litegraph'
import { LiteGraph } from '@comfyorg/litegraph'
import { LGraphNode } from '@comfyorg/litegraph'

export function useCoreCommands(): ComfyCommand[] {
  const getTracker = () => useWorkflowStore()?.activeWorkflow?.changeTracker

  const getSelectedNodes = (): LGraphNode[] => {
    const selectedNodes = app.canvas.selected_nodes
    const result: LGraphNode[] = []
    if (selectedNodes) {
      for (const i in selectedNodes) {
        const node = selectedNodes[i]
        result.push(node)
      }
    }
    return result
  }

  const toggleSelectedNodesMode = (mode: number) => {
    getSelectedNodes().forEach((node) => {
      if (node.mode === mode) {
        node.mode = 0 // always
      } else {
        node.mode = mode
      }
    })
  }

  return [
    {
      id: 'Comfy.NewBlankWorkflow',
      icon: 'pi pi-plus',
      label: 'New Blank Workflow',
      menubarLabel: 'New',
      function: () => workflowService.loadBlankWorkflow()
    },
    {
      id: 'Comfy.OpenWorkflow',
      icon: 'pi pi-folder-open',
      label: 'Open Workflow',
      menubarLabel: 'Open',
      function: () => {
        app.ui.loadFile()
      }
    },
    {
      id: 'Comfy.LoadDefaultWorkflow',
      icon: 'pi pi-code',
      label: 'Load Default Workflow',
      function: () => workflowService.loadDefaultWorkflow()
    },
    {
      id: 'Comfy.SaveWorkflow',
      icon: 'pi pi-save',
      label: 'Save Workflow',
      menubarLabel: 'Save',
      function: async () => {
        const workflow = useWorkflowStore().activeWorkflow as ComfyWorkflow
        if (!workflow) return

        await workflowService.saveWorkflow(workflow)
      }
    },
    {
      id: 'Comfy.SaveWorkflowAs',
      icon: 'pi pi-save',
      label: 'Save Workflow As',
      menubarLabel: 'Save As',
      function: async () => {
        const workflow = useWorkflowStore().activeWorkflow as ComfyWorkflow
        if (!workflow) return

        await workflowService.saveWorkflowAs(workflow)
      }
    },
    {
      id: 'Comfy.ExportWorkflow',
      icon: 'pi pi-download',
      label: 'Export Workflow',
      menubarLabel: 'Export',
      function: () => {
        workflowService.exportWorkflow('workflow', 'workflow')
      }
    },
    {
      id: 'Comfy.ExportWorkflowAPI',
      icon: 'pi pi-download',
      label: 'Export Workflow (API Format)',
      menubarLabel: 'Export (API)',
      function: () => {
        workflowService.exportWorkflow('workflow_api', 'output')
      }
    },
    {
      id: 'Comfy.Undo',
      icon: 'pi pi-undo',
      label: 'Undo',
      function: async () => {
        await getTracker()?.undo?.()
      }
    },
    {
      id: 'Comfy.Redo',
      icon: 'pi pi-refresh',
      label: 'Redo',
      function: async () => {
        await getTracker()?.redo?.()
      }
    },
    {
      id: 'Comfy.ClearWorkflow',
      icon: 'pi pi-trash',
      label: 'Clear Workflow',
      function: () => {
        const settingStore = useSettingStore()
        if (
          !settingStore.get('Comfy.ComfirmClear') ||
          confirm('Clear workflow?')
        ) {
          app.clean()
          app.graph.clear()
          api.dispatchCustomEvent('graphCleared')
        }
      }
    },
    {
      id: 'Comfy.Canvas.ResetView',
      icon: 'pi pi-expand',
      label: 'Reset View',
      function: () => {
        app.resetView()
      }
    },
    {
      id: 'Comfy.OpenClipspace',
      icon: 'pi pi-clipboard',
      label: 'Clipspace',
      function: () => {
        app.openClipspace()
      }
    },
    {
      id: 'Comfy.RefreshNodeDefinitions',
      icon: 'pi pi-refresh',
      label: 'Refresh Node Definitions',
      function: async () => {
        await app.refreshComboInNodes()
      }
    },
    {
      id: 'Comfy.Interrupt',
      icon: 'pi pi-stop',
      label: 'Interrupt',
      function: async () => {
        await api.interrupt()
        useToastStore().add({
          severity: 'info',
          summary: 'Interrupted',
          detail: 'Execution has been interrupted',
          life: 1000
        })
      }
    },
    {
      id: 'Comfy.ClearPendingTasks',
      icon: 'pi pi-stop',
      label: 'Clear Pending Tasks',
      function: async () => {
        await useQueueStore().clear(['queue'])
        useToastStore().add({
          severity: 'info',
          summary: 'Confirmed',
          detail: 'Pending tasks deleted',
          life: 3000
        })
      }
    },
    {
      id: 'Comfy.BrowseTemplates',
      icon: 'pi pi-folder-open',
      label: 'Browse Templates',
      function: showTemplateWorkflowsDialog
    },
    {
      id: 'Comfy.Canvas.ZoomIn',
      icon: 'pi pi-plus',
      label: 'Zoom In',
      function: () => {
        const ds = app.canvas.ds
        ds.changeScale(
          ds.scale * 1.1,
          ds.element ? [ds.element.width / 2, ds.element.height / 2] : undefined
        )
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Canvas.ZoomOut',
      icon: 'pi pi-minus',
      label: 'Zoom Out',
      function: () => {
        const ds = app.canvas.ds
        ds.changeScale(
          ds.scale / 1.1,
          ds.element ? [ds.element.width / 2, ds.element.height / 2] : undefined
        )
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Canvas.FitView',
      icon: 'pi pi-expand',
      label: 'Fit view to selected nodes',
      function: () => app.canvas.fitViewToSelectionAnimated()
    },
    {
      id: 'Comfy.Canvas.ToggleLock',
      icon: 'pi pi-lock',
      label: 'Toggle Lock',
      function: () => {
        app.canvas['read_only'] = !app.canvas['read_only']
      }
    },
    {
      id: 'Comfy.Canvas.ToggleLinkVisibility',
      icon: 'pi pi-eye',
      label: 'Toggle Link Visibility',
      versionAdded: '1.3.6',

      function: (() => {
        const settingStore = useSettingStore()
        let lastLinksRenderMode = LiteGraph.SPLINE_LINK

        return () => {
          const currentMode = settingStore.get('Comfy.LinkRenderMode')

          if (currentMode === LiteGraph.HIDDEN_LINK) {
            // If links are hidden, restore the last positive value or default to spline mode
            settingStore.set('Comfy.LinkRenderMode', lastLinksRenderMode)
          } else {
            // If links are visible, store the current mode and hide links
            lastLinksRenderMode = currentMode
            settingStore.set('Comfy.LinkRenderMode', LiteGraph.HIDDEN_LINK)
          }
        }
      })()
    },
    {
      id: 'Comfy.QueuePrompt',
      icon: 'pi pi-play',
      label: 'Queue Prompt',
      versionAdded: '1.3.7',
      function: () => {
        const batchCount = useQueueSettingsStore().batchCount
        app.queuePrompt(0, batchCount)
      }
    },
    {
      id: 'Comfy.QueuePromptFront',
      icon: 'pi pi-play',
      label: 'Queue Prompt (Front)',
      versionAdded: '1.3.7',
      function: () => {
        const batchCount = useQueueSettingsStore().batchCount
        app.queuePrompt(-1, batchCount)
      }
    },
    {
      id: 'Comfy.ShowSettingsDialog',
      icon: 'pi pi-cog',
      label: 'Settings',
      versionAdded: '1.3.7',
      function: () => {
        showSettingsDialog()
      }
    },
    {
      id: 'Comfy.Graph.GroupSelectedNodes',
      icon: 'pi pi-sitemap',
      label: 'Group Selected Nodes',
      versionAdded: '1.3.7',
      function: () => {
        const { canvas } = app
        if (!canvas.selectedItems?.size) {
          useToastStore().add({
            severity: 'error',
            summary: 'Nothing to group',
            detail:
              'Please select the nodes (or other groups) to create a group for',
            life: 3000
          })
          return
        }
        const group = new LGraphGroup()
        const padding = useSettingStore().get(
          'Comfy.GroupSelectedNodes.Padding'
        )
        group.resizeTo(canvas.selectedItems, padding)
        canvas.graph.add(group)
        useTitleEditorStore().titleEditorTarget = group
      }
    },
    {
      id: 'Workspace.NextOpenedWorkflow',
      icon: 'pi pi-step-forward',
      label: 'Next Opened Workflow',
      versionAdded: '1.3.9',
      function: () => {
        workflowService.loadNextOpenedWorkflow()
      }
    },
    {
      id: 'Workspace.PreviousOpenedWorkflow',
      icon: 'pi pi-step-backward',
      label: 'Previous Opened Workflow',
      versionAdded: '1.3.9',
      function: () => {
        workflowService.loadPreviousOpenedWorkflow()
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
      icon: 'pi pi-volume-off',
      label: 'Mute/Unmute Selected Nodes',
      versionAdded: '1.3.11',
      function: () => {
        toggleSelectedNodesMode(2) // muted
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
      icon: 'pi pi-shield',
      label: 'Bypass/Unbypass Selected Nodes',
      versionAdded: '1.3.11',
      function: () => {
        toggleSelectedNodesMode(4) // bypassed
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Pin',
      icon: 'pi pi-pin',
      label: 'Pin/Unpin Selected Nodes',
      versionAdded: '1.3.11',
      function: () => {
        getSelectedNodes().forEach((node) => {
          node.pin(!node.pinned)
        })
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelected.Pin',
      icon: 'pi pi-pin',
      label: 'Pin/Unpin Selected Items',
      versionAdded: '1.3.33',
      function: () => {
        for (const item of app.canvas.selectedItems) {
          if (item instanceof LGraphNode || item instanceof LGraphGroup) {
            item.pin(!item.pinned)
          }
        }
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
      icon: 'pi pi-minus',
      label: 'Collapse/Expand Selected Nodes',
      versionAdded: '1.3.11',
      function: () => {
        getSelectedNodes().forEach((node) => {
          node.collapse()
        })
      }
    },
    {
      id: 'Comfy.ToggleTheme',
      icon: 'pi pi-moon',
      label: 'Toggle Theme',
      versionAdded: '1.3.12',
      function: (() => {
        let previousDarkTheme: string = 'dark'

        // Official light theme is the only light theme supported now.
        const isDarkMode = (themeId: string) => themeId !== 'light'
        return () => {
          const settingStore = useSettingStore()
          const currentTheme = settingStore.get('Comfy.ColorPalette')
          if (isDarkMode(currentTheme)) {
            previousDarkTheme = currentTheme
            settingStore.set('Comfy.ColorPalette', 'light')
          } else {
            settingStore.set('Comfy.ColorPalette', previousDarkTheme)
          }
        }
      })()
    },
    {
      id: 'Workspace.ToggleBottomPanel',
      icon: 'pi pi-list',
      label: 'Toggle Bottom Panel',
      versionAdded: '1.3.22',
      function: () => {
        useBottomPanelStore().toggleBottomPanel()
      }
    },
    {
      id: 'Workspace.ToggleFocusMode',
      icon: 'pi pi-eye',
      label: 'Toggle Focus Mode',
      versionAdded: '1.3.27',
      function: () => {
        useWorkspaceStore().toggleFocusMode()
      }
    },
    {
      id: 'Comfy.Graph.FitGroupToContents',
      icon: 'pi pi-expand',
      label: 'Fit Group To Contents',
      versionAdded: '1.4.9',
      function: () => {
        for (const group of app.canvas.selectedItems) {
          if (group instanceof LGraphGroup) {
            group.recomputeInsideNodes()
            const padding = useSettingStore().get(
              'Comfy.GroupSelectedNodes.Padding'
            )
            group.resizeTo(group.children, padding)
            app.graph.change()
          }
        }
      }
    },
    {
      id: 'Comfy.Help.OpenComfyUIIssues',
      icon: 'pi pi-github',
      label: 'ComfyUI Issues',
      versionAdded: '1.5.5',
      function: () => {
        window.open(
          'https://github.com/comfyanonymous/ComfyUI/issues',
          '_blank'
        )
      }
    },
    {
      id: 'Comfy.Help.OpenComfyUIDocs',
      icon: 'pi pi-info-circle',
      label: 'ComfyUI Docs',
      versionAdded: '1.5.5',
      function: () => {
        window.open('https://docs.comfy.org/', '_blank')
      }
    },
    {
      id: 'Comfy.Help.OpenComfyOrgDiscord',
      icon: 'pi pi-discord',
      label: 'Comfy-Org Discord',
      versionAdded: '1.5.5',
      function: () => {
        window.open('https://www.comfy.org/discord', '_blank')
      }
    }
  ]
}
