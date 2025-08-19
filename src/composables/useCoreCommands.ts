import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { useModelSelectorDialog } from '@/composables/useModelSelectorDialog'
import {
  DEFAULT_DARK_COLOR_PALETTE,
  DEFAULT_LIGHT_COLOR_PALETTE
} from '@/constants/coreColorPalettes'
import { t } from '@/i18n'
import {
  LGraphEventMode,
  LGraphGroup,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { Point } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { addFluxKontextGroupNode } from '@/scripts/fluxKontextEditNode'
import { useDialogService } from '@/services/dialogService'
import { useLitegraphService } from '@/services/litegraphService'
import { useWorkflowService } from '@/services/workflowService'
import type { ComfyCommand } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore, useTitleEditorStore } from '@/stores/graphStore'
import { useHelpCenterStore } from '@/stores/helpCenterStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useQueueSettingsStore, useQueueStore } from '@/stores/queueStore'
import { useSettingStore } from '@/stores/settingStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useToastStore } from '@/stores/toastStore'
import { type ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  getAllNonIoNodesInSubgraph,
  getExecutionIdsForSelectedNodes
} from '@/utils/graphTraversalUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

const moveSelectedNodesVersionAdded = '1.22.2'

export function useCoreCommands(): ComfyCommand[] {
  const workflowService = useWorkflowService()
  const workflowStore = useWorkflowStore()
  const dialogService = useDialogService()
  const colorPaletteStore = useColorPaletteStore()
  const firebaseAuthActions = useFirebaseAuthActions()
  const toastStore = useToastStore()
  const canvasStore = useCanvasStore()
  const executionStore = useExecutionStore()

  const bottomPanelStore = useBottomPanelStore()

  const { getSelectedNodes, toggleSelectedNodesMode } =
    useSelectedLiteGraphItems()
  const getTracker = () => workflowStore.activeWorkflow?.changeTracker

  const moveSelectedNodes = (
    positionUpdater: (pos: Point, gridSize: number) => Point
  ) => {
    const selectedNodes = getSelectedNodes()
    if (selectedNodes.length === 0) return

    const gridSize = useSettingStore().get('Comfy.SnapToGrid.GridSize')
    selectedNodes.forEach((node) => {
      node.pos = positionUpdater(node.pos, gridSize)
    })
    app.canvas.state.selectionChanged = true
    app.canvas.setDirty(true, true)
  }

  const commands = [
    {
      id: 'Comfy.NewBlankWorkflow',
      icon: 'pi pi-plus',
      label: 'New Blank Workflow',
      menubarLabel: 'New',
      category: 'essentials' as const,
      function: () => workflowService.loadBlankWorkflow()
    },
    {
      id: 'Comfy.OpenWorkflow',
      icon: 'pi pi-folder-open',
      label: 'Open Workflow',
      menubarLabel: 'Open',
      category: 'essentials' as const,
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
      category: 'essentials' as const,
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
      category: 'essentials' as const,
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
      category: 'essentials' as const,
      function: async () => {
        await workflowService.exportWorkflow('workflow', 'workflow')
      }
    },
    {
      id: 'Comfy.ExportWorkflowAPI',
      icon: 'pi pi-download',
      label: 'Export Workflow (API Format)',
      menubarLabel: 'Export (API)',
      function: async () => {
        await workflowService.exportWorkflow('workflow_api', 'output')
      }
    },
    {
      id: 'Comfy.Undo',
      icon: 'pi pi-undo',
      label: 'Undo',
      category: 'essentials' as const,
      function: async () => {
        await getTracker()?.undo?.()
      }
    },
    {
      id: 'Comfy.Redo',
      icon: 'pi pi-refresh',
      label: 'Redo',
      category: 'essentials' as const,
      function: async () => {
        await getTracker()?.redo?.()
      }
    },
    {
      id: 'Comfy.ClearWorkflow',
      icon: 'pi pi-trash',
      label: 'Clear Workflow',
      category: 'essentials' as const,
      function: () => {
        const settingStore = useSettingStore()
        if (
          !settingStore.get('Comfy.ConfirmClear') ||
          confirm('Clear workflow?')
        ) {
          app.clean()
          if (app.canvas.subgraph) {
            // `clear` is not implemented on subgraphs and the parent class's
            // (`LGraph`) `clear` breaks the subgraph structure. For subgraphs,
            // just clear the nodes but preserve input/output nodes and structure
            const subgraph = app.canvas.subgraph
            const nonIoNodes = getAllNonIoNodesInSubgraph(subgraph)
            nonIoNodes.forEach((node) => subgraph.remove(node))
          } else {
            app.graph.clear()
          }
          api.dispatchCustomEvent('graphCleared')
        }
      }
    },
    {
      id: 'Comfy.Canvas.ResetView',
      icon: 'pi pi-expand',
      label: 'Reset View',
      function: () => {
        useLitegraphService().resetView()
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
      category: 'essentials' as const,
      function: async () => {
        await app.refreshComboInNodes()
      }
    },
    {
      id: 'Comfy.Interrupt',
      icon: 'pi pi-stop',
      label: 'Interrupt',
      category: 'essentials' as const,
      function: async () => {
        await api.interrupt(executionStore.activePromptId)
        toastStore.add({
          severity: 'info',
          summary: t('g.interrupted'),
          detail: t('toastMessages.interrupted'),
          life: 1000
        })
      }
    },
    {
      id: 'Comfy.ClearPendingTasks',
      icon: 'pi pi-stop',
      label: 'Clear Pending Tasks',
      category: 'essentials' as const,
      function: async () => {
        await useQueueStore().clear(['queue'])
        toastStore.add({
          severity: 'info',
          summary: t('g.confirmed'),
          detail: t('toastMessages.pendingTasksDeleted'),
          life: 3000
        })
      }
    },
    {
      id: 'Comfy.BrowseTemplates',
      icon: 'pi pi-folder-open',
      label: 'Browse Templates',
      function: () => {
        dialogService.showTemplateWorkflowsDialog()
      }
    },
    {
      id: 'Comfy.Canvas.ZoomIn',
      icon: 'pi pi-plus',
      label: 'Zoom In',
      category: 'view-controls' as const,
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
      category: 'view-controls' as const,
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
      menubarLabel: 'Zoom to fit',
      category: 'view-controls' as const,
      function: () => {
        if (app.canvas.empty) {
          toastStore.add({
            severity: 'error',
            summary: t('toastMessages.emptyCanvas'),
            life: 3000
          })
          return
        }
        app.canvas.fitViewToSelectionAnimated()
      }
    },
    {
      id: 'Comfy.Canvas.ToggleLock',
      icon: 'pi pi-lock',
      label: 'Canvas Toggle Lock',
      function: () => {
        app.canvas['read_only'] = !app.canvas['read_only']
      }
    },
    {
      id: 'Comfy.Canvas.ToggleLinkVisibility',
      icon: 'pi pi-eye',
      label: 'Canvas Toggle Link Visibility',
      menubarLabel: 'Node Links',
      versionAdded: '1.3.6',

      function: (() => {
        const settingStore = useSettingStore()
        let lastLinksRenderMode = LiteGraph.SPLINE_LINK

        return async () => {
          const currentMode = settingStore.get('Comfy.LinkRenderMode')

          if (currentMode === LiteGraph.HIDDEN_LINK) {
            // If links are hidden, restore the last positive value or default to spline mode
            await settingStore.set('Comfy.LinkRenderMode', lastLinksRenderMode)
          } else {
            // If links are visible, store the current mode and hide links
            lastLinksRenderMode = currentMode
            await settingStore.set(
              'Comfy.LinkRenderMode',
              LiteGraph.HIDDEN_LINK
            )
          }
        }
      })(),
      active: () =>
        useSettingStore().get('Comfy.LinkRenderMode') !== LiteGraph.HIDDEN_LINK
    },
    {
      id: 'Comfy.Canvas.ToggleMinimap',
      icon: 'pi pi-map',
      label: 'Canvas Toggle Minimap',
      menubarLabel: 'Minimap',
      versionAdded: '1.24.1',
      function: async () => {
        const settingStore = useSettingStore()
        await settingStore.set(
          'Comfy.Minimap.Visible',
          !settingStore.get('Comfy.Minimap.Visible')
        )
      },
      active: () => useSettingStore().get('Comfy.Minimap.Visible')
    },
    {
      id: 'Comfy.QueuePrompt',
      icon: 'pi pi-play',
      label: 'Queue Prompt',
      versionAdded: '1.3.7',
      category: 'essentials' as const,
      function: async () => {
        const batchCount = useQueueSettingsStore().batchCount
        await app.queuePrompt(0, batchCount)
      }
    },
    {
      id: 'Comfy.QueuePromptFront',
      icon: 'pi pi-play',
      label: 'Queue Prompt (Front)',
      versionAdded: '1.3.7',
      category: 'essentials' as const,
      function: async () => {
        const batchCount = useQueueSettingsStore().batchCount
        await app.queuePrompt(-1, batchCount)
      }
    },
    {
      id: 'Comfy.QueueSelectedOutputNodes',
      icon: 'pi pi-play',
      label: 'Queue Selected Output Nodes',
      versionAdded: '1.19.6',
      function: async () => {
        const batchCount = useQueueSettingsStore().batchCount
        const selectedNodes = getSelectedNodes()
        const selectedOutputNodes = filterOutputNodes(selectedNodes)

        if (selectedOutputNodes.length === 0) {
          toastStore.add({
            severity: 'error',
            summary: t('toastMessages.nothingToQueue'),
            detail: t('toastMessages.pleaseSelectOutputNodes'),
            life: 3000
          })
          return
        }

        // Get execution IDs for all selected output nodes and their descendants
        const executionIds =
          getExecutionIdsForSelectedNodes(selectedOutputNodes)
        await app.queuePrompt(0, batchCount, executionIds)
      }
    },
    {
      id: 'Comfy.ShowSettingsDialog',
      icon: 'pi pi-cog',
      label: 'Show Settings Dialog',
      versionAdded: '1.3.7',
      category: 'view-controls' as const,
      function: () => {
        dialogService.showSettingsDialog()
      }
    },
    {
      id: 'Comfy.Graph.GroupSelectedNodes',
      icon: 'pi pi-sitemap',
      label: 'Group Selected Nodes',
      versionAdded: '1.3.7',
      category: 'essentials' as const,
      function: () => {
        const { canvas } = app
        if (!canvas.selectedItems?.size) {
          toastStore.add({
            severity: 'error',
            summary: t('toastMessages.nothingToGroup'),
            detail: t('toastMessages.pleaseSelectNodesToGroup'),
            life: 3000
          })
          return
        }
        const group = new LGraphGroup()
        const padding = useSettingStore().get(
          'Comfy.GroupSelectedNodes.Padding'
        )
        group.resizeTo(canvas.selectedItems, padding)
        canvas.graph?.add(group)
        useTitleEditorStore().titleEditorTarget = group
      }
    },
    {
      id: 'Workspace.NextOpenedWorkflow',
      icon: 'pi pi-step-forward',
      label: 'Next Opened Workflow',
      versionAdded: '1.3.9',
      function: async () => {
        await workflowService.loadNextOpenedWorkflow()
      }
    },
    {
      id: 'Workspace.PreviousOpenedWorkflow',
      icon: 'pi pi-step-backward',
      label: 'Previous Opened Workflow',
      versionAdded: '1.3.9',
      function: async () => {
        await workflowService.loadPreviousOpenedWorkflow()
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
      icon: 'pi pi-volume-off',
      label: 'Mute/Unmute Selected Nodes',
      versionAdded: '1.3.11',
      category: 'essentials' as const,
      function: () => {
        toggleSelectedNodesMode(LGraphEventMode.NEVER)
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
      icon: 'pi pi-shield',
      label: 'Bypass/Unbypass Selected Nodes',
      versionAdded: '1.3.11',
      category: 'essentials' as const,
      function: () => {
        toggleSelectedNodesMode(LGraphEventMode.BYPASS)
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Pin',
      icon: 'pi pi-pin',
      label: 'Pin/Unpin Selected Nodes',
      versionAdded: '1.3.11',
      category: 'essentials' as const,
      function: () => {
        getSelectedNodes().forEach((node) => {
          node.pin(!node.pinned)
        })
        app.canvas.setDirty(true, true)
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
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Canvas.Resize',
      icon: 'pi pi-minus',
      label: 'Resize Selected Nodes',
      versionAdded: '',
      function: () => {
        getSelectedNodes().forEach((node) => {
          const optimalSize = node.computeSize()
          node.setSize([optimalSize[0], optimalSize[1]])
        })
        app.canvas.setDirty(true, true)
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
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.ToggleTheme',
      icon: 'pi pi-moon',
      label: 'Toggle Theme (Dark/Light)',
      versionAdded: '1.3.12',
      function: (() => {
        let previousDarkTheme: string = DEFAULT_DARK_COLOR_PALETTE.id
        let previousLightTheme: string = DEFAULT_LIGHT_COLOR_PALETTE.id

        return async () => {
          const settingStore = useSettingStore()
          const theme = colorPaletteStore.completedActivePalette
          if (theme.light_theme) {
            previousLightTheme = theme.id
            await settingStore.set('Comfy.ColorPalette', previousDarkTheme)
          } else {
            previousDarkTheme = theme.id
            await settingStore.set('Comfy.ColorPalette', previousLightTheme)
          }
        }
      })()
    },
    {
      id: 'Workspace.ToggleBottomPanel',
      icon: 'pi pi-list',
      label: 'Toggle Bottom Panel',
      menubarLabel: 'Bottom Panel',
      versionAdded: '1.3.22',
      category: 'view-controls' as const,
      function: () => {
        bottomPanelStore.toggleBottomPanel()
      },
      active: () => bottomPanelStore.bottomPanelVisible
    },
    {
      id: 'Workspace.ToggleFocusMode',
      icon: 'pi pi-eye',
      label: 'Toggle Focus Mode',
      menubarLabel: 'Focus Mode',
      versionAdded: '1.3.27',
      category: 'view-controls' as const,
      function: () => {
        useWorkspaceStore().toggleFocusMode()
      },
      active: () => useWorkspaceStore().focusMode
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
      label: 'Open ComfyUI Issues',
      menubarLabel: 'ComfyUI Issues',
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
      label: 'Open ComfyUI Docs',
      menubarLabel: 'ComfyUI Docs',
      versionAdded: '1.5.5',
      function: () => {
        window.open('https://docs.comfy.org/', '_blank')
      }
    },
    {
      id: 'Comfy.Help.OpenComfyOrgDiscord',
      icon: 'pi pi-discord',
      label: 'Open Comfy-Org Discord',
      menubarLabel: 'Comfy-Org Discord',
      versionAdded: '1.5.5',
      function: () => {
        window.open('https://www.comfy.org/discord', '_blank')
      }
    },
    {
      id: 'Workspace.SearchBox.Toggle',
      icon: 'pi pi-search',
      label: 'Toggle Search Box',
      versionAdded: '1.5.7',
      function: () => {
        useSearchBoxStore().toggleVisible()
      }
    },
    {
      id: 'Comfy.Help.AboutComfyUI',
      icon: 'pi pi-info-circle',
      label: 'Open About ComfyUI',
      menubarLabel: 'About ComfyUI',
      versionAdded: '1.6.4',
      function: () => {
        dialogService.showSettingsDialog('about')
      }
    },
    {
      id: 'Comfy.DuplicateWorkflow',
      icon: 'pi pi-clone',
      label: 'Duplicate Current Workflow',
      versionAdded: '1.6.15',
      function: async () => {
        await workflowService.duplicateWorkflow(workflowStore.activeWorkflow!)
      }
    },
    {
      id: 'Workspace.CloseWorkflow',
      icon: 'pi pi-times',
      label: 'Close Current Workflow',
      versionAdded: '1.7.3',
      function: async () => {
        if (workflowStore.activeWorkflow)
          await workflowService.closeWorkflow(workflowStore.activeWorkflow)
      }
    },
    {
      id: 'Comfy.Feedback',
      icon: 'pi pi-megaphone',
      label: 'Give Feedback',
      versionAdded: '1.8.2',
      function: () => {
        dialogService.showIssueReportDialog({
          title: t('g.feedback'),
          subtitle: t('issueReport.feedbackTitle'),
          panelProps: {
            errorType: 'Feedback',
            defaultFields: ['SystemStats', 'Settings']
          }
        })
      }
    },
    {
      id: 'Comfy.ContactSupport',
      icon: 'pi pi-question',
      label: 'Contact Support',
      versionAdded: '1.17.8',
      function: () => {
        dialogService.showIssueReportDialog({
          title: t('issueReport.contactSupportTitle'),
          subtitle: t('issueReport.contactSupportDescription'),
          panelProps: {
            errorType: 'ContactSupport',
            defaultFields: ['Workflow', 'Logs', 'SystemStats', 'Settings']
          }
        })
      }
    },
    {
      id: 'Comfy.Help.OpenComfyUIForum',
      icon: 'pi pi-comments',
      label: 'Open ComfyUI Forum',
      menubarLabel: 'ComfyUI Forum',
      versionAdded: '1.8.2',
      function: () => {
        window.open('https://forum.comfy.org/', '_blank')
      }
    },
    {
      id: 'Comfy.Canvas.DeleteSelectedItems',
      icon: 'pi pi-trash',
      label: 'Delete Selected Items',
      versionAdded: '1.10.5',
      function: () => {
        app.canvas.deleteSelected()
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Manager.CustomNodesManager',
      icon: 'pi pi-puzzle',
      label: 'Toggle the Custom Nodes Manager',
      versionAdded: '1.12.10',
      function: () => {
        dialogService.toggleManagerDialog()
      }
    },
    {
      id: 'Comfy.Manager.ToggleManagerProgressDialog',
      icon: 'pi pi-spinner',
      label: 'Toggle the Custom Nodes Manager Progress Bar',
      versionAdded: '1.13.9',
      function: () => {
        dialogService.toggleManagerProgressDialog()
      }
    },
    {
      id: 'Comfy.User.OpenSignInDialog',
      icon: 'pi pi-user',
      label: 'Open Sign In Dialog',
      versionAdded: '1.17.6',
      function: async () => {
        await dialogService.showSignInDialog()
      }
    },
    {
      id: 'Comfy.User.SignOut',
      icon: 'pi pi-sign-out',
      label: 'Sign Out',
      versionAdded: '1.18.1',
      function: async () => {
        await firebaseAuthActions.logout()
      }
    },
    {
      id: 'Comfy.Canvas.MoveSelectedNodes.Up',
      icon: 'pi pi-arrow-up',
      label: 'Move Selected Nodes Up',
      versionAdded: moveSelectedNodesVersionAdded,
      function: () => moveSelectedNodes(([x, y], gridSize) => [x, y - gridSize])
    },
    {
      id: 'Comfy.Canvas.MoveSelectedNodes.Down',
      icon: 'pi pi-arrow-down',
      label: 'Move Selected Nodes Down',
      versionAdded: moveSelectedNodesVersionAdded,
      function: () => moveSelectedNodes(([x, y], gridSize) => [x, y + gridSize])
    },
    {
      id: 'Comfy.Canvas.MoveSelectedNodes.Left',
      icon: 'pi pi-arrow-left',
      label: 'Move Selected Nodes Left',
      versionAdded: moveSelectedNodesVersionAdded,
      function: () => moveSelectedNodes(([x, y], gridSize) => [x - gridSize, y])
    },
    {
      id: 'Comfy.Canvas.MoveSelectedNodes.Right',
      icon: 'pi pi-arrow-right',
      label: 'Move Selected Nodes Right',
      versionAdded: moveSelectedNodesVersionAdded,
      function: () => moveSelectedNodes(([x, y], gridSize) => [x + gridSize, y])
    },
    {
      id: 'Comfy.Canvas.AddEditModelStep',
      icon: 'pi pi-pen-to-square',
      label: 'Add Edit Model Step',
      versionAdded: '1.23.3',
      function: async () => {
        const node = app.canvas.selectedItems.values().next().value
        if (!(node instanceof LGraphNode)) return
        await addFluxKontextGroupNode(node)
      }
    },
    {
      id: 'Comfy.Graph.ConvertToSubgraph',
      icon: 'pi pi-sitemap',
      label: 'Convert Selection to Subgraph',
      versionAdded: '1.20.1',
      category: 'essentials' as const,
      function: () => {
        const canvas = canvasStore.getCanvas()
        const graph = canvas.subgraph ?? canvas.graph
        if (!graph) throw new TypeError('Canvas has no graph or subgraph set.')

        const res = graph.convertToSubgraph(canvas.selectedItems)
        if (!res) {
          toastStore.add({
            severity: 'error',
            summary: t('toastMessages.cannotCreateSubgraph'),
            detail: t('toastMessages.failedToConvertToSubgraph'),
            life: 3000
          })
          return
        }
        const { node } = res
        canvas.select(node)
        canvasStore.updateSelectedItems()
      }
    },
    {
      id: 'Comfy.Graph.UnpackSubgraph',
      icon: 'pi pi-sitemap',
      label: 'Unpack the selected Subgraph',
      versionAdded: '1.20.1',
      category: 'essentials' as const,
      function: () => {
        const canvas = canvasStore.getCanvas()
        const graph = canvas.subgraph ?? canvas.graph
        if (!graph) throw new TypeError('Canvas has no graph or subgraph set.')

        const subgraphNode = app.canvas.selectedItems.values().next().value
        if (!(subgraphNode instanceof SubgraphNode)) return
        useNodeOutputStore().revokeSubgraphPreviews(subgraphNode)
        graph.unpackSubgraph(subgraphNode)
      }
    },
    {
      id: 'Comfy.OpenManagerDialog',
      icon: 'mdi mdi-puzzle-outline',
      label: 'Manager',
      function: () => {
        dialogService.showManagerDialog()
      }
    },
    {
      id: 'Comfy.ToggleHelpCenter',
      icon: 'pi pi-question-circle',
      label: 'Help Center',
      function: () => {
        useHelpCenterStore().toggle()
      },
      active: () => useHelpCenterStore().isVisible
    },
    {
      id: 'Comfy.ToggleCanvasInfo',
      icon: 'pi pi-info-circle',
      label: 'Canvas Performance',
      function: async () => {
        const settingStore = useSettingStore()
        const currentValue = settingStore.get('Comfy.Graph.CanvasInfo')
        await settingStore.set('Comfy.Graph.CanvasInfo', !currentValue)
      },
      active: () => useSettingStore().get('Comfy.Graph.CanvasInfo')
    },
    {
      id: 'Workspace.ToggleBottomPanel.Shortcuts',
      icon: 'pi pi-key',
      label: 'Show Keybindings Dialog',
      versionAdded: '1.24.1',
      category: 'view-controls' as const,
      function: () => {
        bottomPanelStore.togglePanel('shortcuts')
      }
    },
    {
      id: 'Comfy.Graph.ExitSubgraph',
      icon: 'pi pi-arrow-up',
      label: 'Exit Subgraph',
      versionAdded: '1.20.1',
      function: () => {
        const canvas = useCanvasStore().getCanvas()
        const navigationStore = useSubgraphNavigationStore()
        if (!canvas.graph) return

        canvas.setGraph(
          navigationStore.navigationStack.at(-2) ?? canvas.graph.rootGraph
        )
      }
    },
    {
      id: 'Comfy.Dev.ShowModelSelector',
      icon: 'pi pi-box',
      label: 'Show Model Selector (Dev)',
      versionAdded: '1.26.2',
      category: 'view-controls' as const,
      function: () => {
        const modelSelectorDialog = useModelSelectorDialog()
        modelSelectorDialog.show()
      }
    }
  ]

  return commands.map((command) => ({ ...command, source: 'System' }))
}
