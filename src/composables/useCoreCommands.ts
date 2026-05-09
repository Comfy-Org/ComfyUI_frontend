import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { useSubgraphOperations } from '@/composables/graph/useSubgraphOperations'
import { useExternalLink } from '@/composables/useExternalLink'
import { useModelSelectorDialog } from '@/composables/useModelSelectorDialog'
import {
  DEFAULT_DARK_COLOR_PALETTE,
  DEFAULT_LIGHT_COLOR_PALETTE
} from '@/constants/coreColorPalettes'

import { tryToggleWidgetPromotion } from '@/core/graph/subgraph/promotionUtils'
import { t } from '@/i18n'
import {
  LGraphEventMode,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { Point } from '@/lib/litegraph/src/litegraph'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { createModelNodeFromAsset } from '@/platform/assets/utils/createModelNodeFromAsset'
import { useSettingStore } from '@/platform/settings/settingStore'
import { buildSupportUrl } from '@/platform/support/config'
import { useTelemetry } from '@/platform/telemetry'
import type { ExecutionTriggerSource } from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  useCanvasStore,
  useTitleEditorStore
} from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useDialogService } from '@/services/dialogService'
import { useLitegraphService } from '@/services/litegraphService'
import type { ComfyCommand } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useHelpCenterStore } from '@/stores/helpCenterStore'
import {
  useQueueSettingsStore,
  useQueueStore,
  useQueueUIStore
} from '@/stores/queueStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { ensureWorkflowSuffix, getWorkflowSuffix } from '@/utils/formatUtil'
import {
  getAllNonIoNodesInSubgraph,
  getExecutionIdsForSelectedNodes
} from '@/utils/graphTraversalUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'
import {
  ManagerUIState,
  useManagerState
} from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

import { useWorkflowTemplateSelectorDialog } from './useWorkflowTemplateSelectorDialog'

import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useDialogStore } from '@/stores/dialogStore'

const moveSelectedNodesVersionAdded = '1.22.2'
export function useCoreCommands(): ComfyCommand[] {
  const { isActiveSubscription, showSubscriptionDialog } = useBillingContext()
  const workflowService = useWorkflowService()
  const workflowStore = useWorkflowStore()
  const settingsDialog = useSettingsDialog()
  const dialogService = useDialogService()
  const colorPaletteStore = useColorPaletteStore()
  const authActions = useAuthActions()
  const toastStore = useToastStore()
  const canvasStore = useCanvasStore()
  const executionStore = useExecutionStore()
  const telemetry = useTelemetry()
  const { staticUrls, buildDocsUrl } = useExternalLink()
  const settingStore = useSettingStore()

  const bottomPanelStore = useBottomPanelStore()

  const dialogStore = useDialogStore()
  const maskEditorStore = useMaskEditorStore()

  const { getSelectedNodes, toggleSelectedNodesMode } =
    useSelectedLiteGraphItems()
  const getTracker = () => workflowStore.activeWorkflow?.changeTracker

  function isQueuePanelV2Enabled() {
    return settingStore.get('Comfy.Queue.QPOV2')
  }

  async function toggleQueuePanelV2() {
    await settingStore.set('Comfy.Queue.QPOV2', !isQueuePanelV2Enabled())
  }

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
      label: t('g.new_blank_workflow'),
      menubarLabel: t('g.new'),
      category: 'essentials' as const,
      function: async () => {
        const previousWorkflowHadNodes = app.rootGraph._nodes.length > 0
        await workflowService.loadBlankWorkflow()
        telemetry?.trackWorkflowCreated({
          workflow_type: 'blank',
          previous_workflow_had_nodes: previousWorkflowHadNodes
        })
      }
    },
    {
      id: 'Comfy.OpenWorkflow',
      icon: 'pi pi-folder-open',
      label: t('g.open_workflow'),
      menubarLabel: t('g.open'),
      category: 'essentials' as const,
      function: () => {
        app.ui.loadFile()
      }
    },
    {
      id: 'Comfy.LoadDefaultWorkflow',
      icon: 'pi pi-code',
      label: t('g.load_default_workflow'),
      function: async () => {
        const previousWorkflowHadNodes = app.rootGraph._nodes.length > 0
        await workflowService.loadDefaultWorkflow()
        telemetry?.trackWorkflowCreated({
          workflow_type: 'default',
          previous_workflow_had_nodes: previousWorkflowHadNodes
        })
      }
    },
    {
      id: 'Comfy.SaveWorkflow',
      icon: 'pi pi-save',
      label: t('g.save_workflow'),
      menubarLabel: t('g.save'),
      category: 'essentials' as const,
      function: async () => {
        const workflow = useWorkflowStore().activeWorkflow as ComfyWorkflow
        if (!workflow) return

        await workflowService.saveWorkflow(workflow)
      }
    },
    {
      id: 'Comfy.PublishSubgraph',
      icon: 'pi pi-save',
      label: t('g.publish_subgraph'),
      menubarLabel: t('g.publish'),
      function: async (metadata?: Record<string, unknown>) => {
        const name = metadata?.name as string | undefined
        await useSubgraphStore().publishSubgraph(name)
      }
    },
    {
      id: 'Comfy.SaveWorkflowAs',
      icon: 'pi pi-save',
      label: t('g.save_workflow_as'),
      menubarLabel: t('g.save_as'),
      category: 'essentials' as const,
      function: async () => {
        const workflow = useWorkflowStore().activeWorkflow as ComfyWorkflow
        if (!workflow) return

        await workflowService.saveWorkflowAs(workflow)
      }
    },
    {
      id: 'Comfy.RenameWorkflow',
      icon: 'pi pi-pencil',
      label: t('g.rename_workflow'),
      menubarLabel: t('g.rename'),
      function: async () => {
        const workflow = workflowStore.activeWorkflow
        if (!workflow || !workflow.isPersisted) return

        const newName = await dialogService.prompt({
          title: t('g.rename'),
          message: t('workflowService.enterFilenamePrompt'),
          defaultValue: workflow.filename
        })
        if (!newName || newName === workflow.filename) return

        const suffix = getWorkflowSuffix(workflow.suffix)
        const newPath =
          workflow.directory + '/' + ensureWorkflowSuffix(newName, suffix)
        await workflowService.renameWorkflow(workflow, newPath)
      }
    },
    {
      id: 'Comfy.ExportWorkflow',
      icon: 'pi pi-download',
      label: t('g.export_workflow'),
      menubarLabel: t('g.export'),
      category: 'essentials' as const,
      function: async () => {
        await workflowService.exportWorkflow('workflow', 'workflow')
      }
    },
    {
      id: 'Comfy.ExportWorkflowAPI',
      icon: 'pi pi-download',
      label: t('g.export_workflow_api_format'),
      menubarLabel: t('g.export_api'),
      function: async () => {
        await workflowService.exportWorkflow('workflow_api', 'output')
      }
    },
    {
      id: 'Comfy.Undo',
      icon: 'pi pi-undo',
      label: t('g.undo'),
      category: 'essentials' as const,
      function: async () => {
        // If Mask Editor is open, use its history instead of the graph
        if (dialogStore.isDialogOpen('global-mask-editor')) {
          maskEditorStore.canvasHistory.undo()
        } else {
          await getTracker()?.undo?.()
        }
      }
    },
    {
      id: 'Comfy.Redo',
      icon: 'pi pi-refresh',
      label: t('g.redo'),
      category: 'essentials' as const,
      function: async () => {
        if (dialogStore.isDialogOpen('global-mask-editor')) {
          maskEditorStore.canvasHistory.redo()
        } else {
          await getTracker()?.redo?.()
        }
      }
    },
    {
      id: 'Comfy.ClearWorkflow',
      icon: 'pi pi-trash',
      label: t('g.clear_workflow'),
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
          }
          api.dispatchCustomEvent('graphCleared')
        }
      }
    },
    {
      id: 'Comfy.Canvas.ResetView',
      icon: 'pi pi-expand',
      label: t('g.reset_view'),
      function: () => {
        useLitegraphService().resetView()
      }
    },
    {
      id: 'Comfy.OpenClipspace',
      icon: 'pi pi-clipboard',
      label: t('g.clipspace'),
      function: () => {
        app.openClipspace()
      }
    },
    {
      id: 'Comfy.RefreshNodeDefinitions',
      icon: 'pi pi-refresh',
      label: t('g.refresh_node_definitions'),
      category: 'essentials' as const,
      function: async () => {
        await app.refreshComboInNodes()
      }
    },
    {
      id: 'Comfy.Interrupt',
      icon: 'pi pi-stop',
      label: t('g.interrupt'),
      category: 'essentials' as const,
      function: async () => {
        await api.interrupt(executionStore.activeJobId)
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
      label: t('g.clear_pending_tasks'),
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
      label: t('g.browse_templates'),
      function: () => {
        useWorkflowTemplateSelectorDialog().show()
      }
    },
    {
      id: 'Comfy.Canvas.ZoomIn',
      icon: 'pi pi-plus',
      label: t('g.zoom_in'),
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
      label: t('g.zoom_out'),
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
      id: 'Experimental.ToggleVueNodes',
      label: () =>
        `Experimental: ${
          useSettingStore().get('Comfy.VueNodes.Enabled') ? 'Disable' : 'Enable'
        } Nodes 2.0`,
      function: async () => {
        const settingStore = useSettingStore()
        const current = settingStore.get('Comfy.VueNodes.Enabled') ?? false
        await settingStore.set('Comfy.VueNodes.Enabled', !current)
      }
    },
    {
      id: 'Comfy.Canvas.FitView',
      icon: 'pi pi-expand',
      label: t('g.fit_view_to_selected_nodes'),
      menubarLabel: t('g.zoom_to_fit'),
      category: 'view-controls' as const,
      function: () => {
        if (app.canvas.empty) {
          toastStore.add({
            severity: 'error',
            summary: t('toastMessages.emptyCanvas')
          })
          return
        }
        app.canvas.fitViewToSelectionAnimated()
      }
    },
    {
      id: 'Comfy.Canvas.ToggleLock',
      icon: 'pi pi-lock',
      label: t('g.canvas_toggle_lock'),
      category: 'view-controls' as const,
      function: () => {
        app.canvas.state.readOnly = !app.canvas.state.readOnly
      }
    },
    {
      id: 'Comfy.Canvas.Lock',
      icon: 'pi pi-lock',
      label: t('g.lock_canvas'),
      category: 'view-controls' as const,
      function: () => {
        app.canvas.state.readOnly = true
      }
    },
    {
      id: 'Comfy.Canvas.Unlock',
      icon: 'pi pi-lock-open',
      label: t('g.unlock_canvas'),
      function: () => {
        app.canvas.state.readOnly = false
      }
    },
    {
      id: 'Comfy.Canvas.ToggleLinkVisibility',
      icon: 'pi pi-eye',
      label: t('g.canvas_toggle_link_visibility'),
      menubarLabel: t('g.node_links'),
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
      label: t('g.canvas_toggle_minimap'),
      menubarLabel: t('g.minimap'),
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
      id: 'Comfy.Queue.ToggleOverlay',
      icon: 'pi pi-history',
      label: () => t('queue.toggleJobHistory'),
      menubarLabel: () => t('queue.jobHistory'),
      versionAdded: '1.37.0',
      category: 'view-controls' as const,
      function: () => {
        useQueueUIStore().toggleOverlay()
      },
      active: () => useQueueUIStore().isOverlayExpanded
    },
    {
      id: 'Comfy.QueuePrompt',
      icon: 'pi pi-play',
      label: t('g.queue_prompt'),
      versionAdded: '1.3.7',
      category: 'essentials' as const,
      function: async (metadata?: {
        subscribe_to_run?: boolean
        trigger_source?: ExecutionTriggerSource
      }) => {
        useTelemetry()?.trackRunButton(metadata)
        if (!isActiveSubscription.value) {
          showSubscriptionDialog()
          return
        }

        const batchCount = useQueueSettingsStore().batchCount

        useTelemetry()?.trackWorkflowExecution()

        await app.queuePrompt(0, batchCount)
      }
    },
    {
      id: 'Comfy.QueuePromptFront',
      icon: 'pi pi-play',
      label: t('g.queue_prompt_front'),
      versionAdded: '1.3.7',
      category: 'essentials' as const,
      function: async (metadata?: {
        subscribe_to_run?: boolean
        trigger_source?: ExecutionTriggerSource
      }) => {
        useTelemetry()?.trackRunButton(metadata)
        if (!isActiveSubscription.value) {
          showSubscriptionDialog()
          return
        }

        const batchCount = useQueueSettingsStore().batchCount

        useTelemetry()?.trackWorkflowExecution()

        await app.queuePrompt(-1, batchCount)
      }
    },
    {
      id: 'Comfy.QueueSelectedOutputNodes',
      icon: 'pi pi-play',
      label: t('g.queue_selected_output_nodes'),
      versionAdded: '1.19.6',
      function: async (metadata?: {
        subscribe_to_run?: boolean
        trigger_source?: ExecutionTriggerSource
      }) => {
        useTelemetry()?.trackRunButton(metadata)
        if (!isActiveSubscription.value) {
          showSubscriptionDialog()
          return
        }

        const batchCount = useQueueSettingsStore().batchCount
        const selectedNodes = getSelectedNodes()
        const selectedOutputNodes = filterOutputNodes(selectedNodes)

        if (selectedOutputNodes.length === 0) {
          toastStore.add({
            severity: 'error',
            summary: t('toastMessages.nothingToQueue'),
            detail: t('toastMessages.pleaseSelectOutputNodes')
          })
          return
        }

        // Get execution IDs for all selected output nodes and their descendants
        const executionIds =
          getExecutionIdsForSelectedNodes(selectedOutputNodes)

        if (executionIds.length === 0) {
          toastStore.add({
            severity: 'error',
            summary: t('toastMessages.failedToQueue'),
            detail: t('toastMessages.failedExecutionPathResolution')
          })
          return
        }
        useTelemetry()?.trackWorkflowExecution()
        await app.queuePrompt(0, batchCount, executionIds)
      }
    },
    {
      id: 'Comfy.ShowSettingsDialog',
      icon: 'pi pi-cog',
      label: t('g.show_settings_dialog'),
      versionAdded: '1.3.7',
      category: 'view-controls' as const,
      function: () => {
        settingsDialog.show()
      }
    },
    {
      id: 'Comfy.Graph.GroupSelectedNodes',
      icon: 'pi pi-sitemap',
      label: t('g.group_selected_nodes'),
      versionAdded: '1.3.7',
      category: 'essentials' as const,
      function: () => {
        const { canvas } = app
        if (!canvas.selectedItems?.size) {
          toastStore.add({
            severity: 'error',
            summary: t('toastMessages.nothingToGroup'),
            detail: t('toastMessages.pleaseSelectNodesToGroup')
          })
          return
        }
        const group = new LGraphGroup()
        const padding = useSettingStore().get(
          'Comfy.GroupSelectedNodes.Padding'
        )
        group.resizeTo(canvas.selectedItems, padding)
        canvas.graph?.add(group)

        group.recomputeInsideNodes()

        useTitleEditorStore().titleEditorTarget = group
      }
    },
    {
      id: 'Workspace.NextOpenedWorkflow',
      icon: 'pi pi-step-forward',
      label: t('g.next_opened_workflow'),
      versionAdded: '1.3.9',
      function: async () => {
        await workflowService.loadNextOpenedWorkflow()
      }
    },
    {
      id: 'Workspace.PreviousOpenedWorkflow',
      icon: 'pi pi-step-backward',
      label: t('g.previous_opened_workflow'),
      versionAdded: '1.3.9',
      function: async () => {
        await workflowService.loadPreviousOpenedWorkflow()
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
      icon: 'pi pi-volume-off',
      label: t('g.mute_unmute_selected_nodes'),
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
      label: t('g.bypass_unbypass_selected_nodes'),
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
      label: t('g.pin_unpin_selected_nodes'),
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
      label: t('g.pin_unpin_selected_items'),
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
      label: t('g.resize_selected_nodes'),
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
      label: t('g.collapse_expand_selected_nodes'),
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
      label: t('g.toggle_theme_dark_light'),
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
      label: t('g.toggle_bottom_panel'),
      menubarLabel: t('g.bottom_panel'),
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
      label: t('g.toggle_focus_mode'),
      menubarLabel: t('g.focus_mode'),
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
      label: t('g.fit_group_to_contents'),
      versionAdded: '1.4.9',
      function: () => {
        for (const group of app.canvas.selectedItems) {
          if (group instanceof LGraphGroup) {
            group.recomputeInsideNodes()
            const padding = useSettingStore().get(
              'Comfy.GroupSelectedNodes.Padding'
            )
            group.resizeTo(group.children, padding)
            app.canvas.setDirty(false, true)
          }
        }
      }
    },
    {
      id: 'Comfy.Help.OpenComfyUIIssues',
      icon: 'pi pi-github',
      label: t('g.open_comfyui_issues'),
      menubarLabel: t('g.comfyui_issues'),
      versionAdded: '1.5.5',
      function: () => {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'github',
          is_external: true,
          source: 'menu'
        })
        window.open(staticUrls.githubIssues, '_blank')
      }
    },
    {
      id: 'Comfy.Help.OpenComfyUIDocs',
      icon: 'pi pi-info-circle',
      label: t('g.open_comfyui_docs'),
      menubarLabel: t('g.comfyui_docs'),
      versionAdded: '1.5.5',
      function: () => {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'docs',
          is_external: true,
          source: 'menu'
        })
        window.open(buildDocsUrl('/', { includeLocale: true }), '_blank')
      }
    },
    {
      id: 'Comfy.Help.OpenComfyOrgDiscord',
      icon: 'pi pi-discord',
      label: t('g.open_comfy_org_discord'),
      menubarLabel: t('g.comfy_org_discord'),
      versionAdded: '1.5.5',
      function: () => {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'discord',
          is_external: true,
          source: 'menu'
        })
        window.open(staticUrls.discord, '_blank')
      }
    },
    {
      id: 'Workspace.SearchBox.Toggle',
      icon: 'pi pi-search',
      label: t('g.toggle_search_box'),
      versionAdded: '1.5.7',
      function: () => {
        useSearchBoxStore().toggleVisible()
      }
    },
    {
      id: 'Comfy.Help.AboutComfyUI',
      icon: 'pi pi-info-circle',
      label: t('g.open_about_comfyui'),
      menubarLabel: t('g.about_comfyui'),
      versionAdded: '1.6.4',
      function: () => {
        settingsDialog.showAbout()
      }
    },
    {
      id: 'Comfy.DuplicateWorkflow',
      icon: 'pi pi-clone',
      label: t('g.duplicate_current_workflow'),
      versionAdded: '1.6.15',
      function: async () => {
        await workflowService.duplicateWorkflow(workflowStore.activeWorkflow!)
      }
    },
    {
      id: 'Workspace.CloseWorkflow',
      icon: 'pi pi-times',
      label: t('g.close_current_workflow'),
      versionAdded: '1.7.3',
      function: async () => {
        if (workflowStore.activeWorkflow)
          await workflowService.closeWorkflow(workflowStore.activeWorkflow)
      }
    },
    {
      id: 'Comfy.ContactSupport',
      icon: 'pi pi-question',
      label: t('g.contact_support'),
      versionAdded: '1.17.8',
      function: () => {
        const { userEmail, resolvedUserInfo } = useCurrentUser()
        const supportUrl = buildSupportUrl({
          userEmail: userEmail.value,
          userId: resolvedUserInfo.value?.id
        })
        window.open(supportUrl, '_blank', 'noopener,noreferrer')
      }
    },
    {
      id: 'Comfy.Help.OpenComfyUIForum',
      icon: 'pi pi-comments',
      label: t('g.open_comfyui_forum'),
      menubarLabel: t('g.comfyui_forum'),
      versionAdded: '1.8.2',
      function: () => {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'help_feedback',
          is_external: true,
          source: 'menu'
        })
        window.open(staticUrls.forum, '_blank')
      }
    },
    {
      id: 'Comfy.Canvas.CopySelected',
      icon: 'icon-[lucide--copy]',
      label: t('g.copy'),
      function: () => {
        if (app.canvas.selectedItems?.size) {
          app.canvas.copyToClipboard()
        }
      }
    },
    {
      id: 'Comfy.Canvas.PasteFromClipboard',
      icon: 'icon-[lucide--clipboard-paste]',
      label: t('g.paste'),
      function: () => {
        app.canvas.pasteFromClipboard()
      }
    },
    {
      id: 'Comfy.Canvas.PasteFromClipboardWithConnect',
      icon: 'icon-[lucide--clipboard-paste]',
      label: () => t('Paste with Connect'),
      function: () => {
        app.canvas.pasteFromClipboard({ connectInputs: true })
      }
    },
    {
      id: 'Comfy.Canvas.SelectAll',
      icon: 'icon-[lucide--lasso-select]',
      label: t('g.select_all'),
      function: () => {
        app.canvas.selectItems()
      }
    },
    {
      id: 'Comfy.Canvas.DeleteSelectedItems',
      icon: 'pi pi-trash',
      label: t('g.delete_selected_items'),
      versionAdded: '1.10.5',
      function: () => {
        if (app.canvas.selectedItems.size === 0) {
          app.canvas.canvas.dispatchEvent(
            new CustomEvent('litegraph:no-items-selected', { bubbles: true })
          )
          return
        }
        app.canvas.deleteSelected()
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Manager.CustomNodesManager.ShowCustomNodesMenu',
      icon: 'pi pi-puzzle',
      label: t('g.custom_nodes_manager'),
      versionAdded: '1.12.10',
      function: async () => {
        await useManagerState().openManager({
          showToastOnLegacyError: true
        })
      }
    },
    {
      id: 'Comfy.Manager.ShowUpdateAvailablePacks',
      icon: 'pi pi-sync',
      label: t('g.check_for_custom_node_updates'),
      versionAdded: '1.17.0',
      function: async () => {
        const managerState = useManagerState()
        const state = managerState.managerUIState.value

        // For DISABLED state, show error toast instead of opening settings
        if (state === ManagerUIState.DISABLED) {
          toastStore.add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('manager.notAvailable')
          })
          return
        }

        await managerState.openManager({
          initialTab: ManagerTab.UpdateAvailable,
          showToastOnLegacyError: false
        })
      }
    },
    {
      id: 'Comfy.Manager.ShowMissingPacks',
      icon: 'pi pi-exclamation-circle',
      label: t('g.install_missing_custom_nodes'),
      versionAdded: '1.17.0',
      function: async () => {
        await useManagerState().openManager({
          initialTab: ManagerTab.Missing,
          showToastOnLegacyError: false
        })
      }
    },
    {
      id: 'Comfy.User.OpenSignInDialog',
      icon: 'pi pi-user',
      label: t('g.open_sign_in_dialog'),
      versionAdded: '1.17.6',
      function: async () => {
        await dialogService.showSignInDialog()
      }
    },
    {
      id: 'Comfy.User.SignOut',
      icon: 'pi pi-sign-out',
      label: t('g.sign_out'),
      versionAdded: '1.18.1',
      function: async () => {
        await authActions.logout()
      }
    },
    {
      id: 'Comfy.Canvas.MoveSelectedNodes.Up',
      icon: 'pi pi-arrow-up',
      label: t('g.move_selected_nodes_up'),
      versionAdded: moveSelectedNodesVersionAdded,
      function: () => moveSelectedNodes(([x, y], gridSize) => [x, y - gridSize])
    },
    {
      id: 'Comfy.Canvas.MoveSelectedNodes.Down',
      icon: 'pi pi-arrow-down',
      label: t('g.move_selected_nodes_down'),
      versionAdded: moveSelectedNodesVersionAdded,
      function: () => moveSelectedNodes(([x, y], gridSize) => [x, y + gridSize])
    },
    {
      id: 'Comfy.Canvas.MoveSelectedNodes.Left',
      icon: 'pi pi-arrow-left',
      label: t('g.move_selected_nodes_left'),
      versionAdded: moveSelectedNodesVersionAdded,
      function: () => moveSelectedNodes(([x, y], gridSize) => [x - gridSize, y])
    },
    {
      id: 'Comfy.Canvas.MoveSelectedNodes.Right',
      icon: 'pi pi-arrow-right',
      label: t('g.move_selected_nodes_right'),
      versionAdded: moveSelectedNodesVersionAdded,
      function: () => moveSelectedNodes(([x, y], gridSize) => [x + gridSize, y])
    },
    {
      id: 'Comfy.Graph.ConvertToSubgraph',
      icon: 'icon-[lucide--shrink]',
      label: t('g.convert_selection_to_subgraph'),
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
            detail: t('toastMessages.failedToConvertToSubgraph')
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
      icon: 'icon-[lucide--expand]',
      label: t('g.unpack_the_selected_subgraph'),
      versionAdded: '1.26.3',
      function: () => {
        const { unpackSubgraph } = useSubgraphOperations()
        unpackSubgraph()
      }
    },
    {
      id: 'Comfy.Graph.EditSubgraphWidgets',
      label: t('g.edit_subgraph_widgets'),
      icon: 'icon-[lucide--settings-2]',
      versionAdded: '1.28.5',
      function: () => {
        useRightSidePanelStore().openPanel('subgraph')
      }
    },
    {
      id: 'Comfy.Graph.ToggleWidgetPromotion',
      icon: 'icon-[lucide--arrow-left-right]',
      label: t('g.toggle_promotion_of_hovered_widget'),
      versionAdded: '1.30.1',
      function: tryToggleWidgetPromotion
    },
    {
      id: 'Comfy.OpenManagerDialog',
      icon: 'mdi mdi-puzzle-outline',
      label: t('g.manager'),
      function: async () => {
        await useManagerState().openManager({
          initialTab: ManagerTab.All,
          showToastOnLegacyError: false
        })
      }
    },
    {
      id: 'Comfy.ToggleHelpCenter',
      icon: 'pi pi-question-circle',
      label: t('g.help_center'),
      function: () => {
        useHelpCenterStore().toggle()
      },
      active: () => useHelpCenterStore().isVisible
    },
    {
      id: 'Comfy.ToggleCanvasInfo',
      icon: 'pi pi-info-circle',
      label: t('g.canvas_performance'),
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
      label: t('g.show_keybindings_dialog'),
      versionAdded: '1.24.1',
      category: 'view-controls' as const,
      function: () => {
        bottomPanelStore.togglePanel('shortcuts')
      }
    },
    {
      id: 'Comfy.Graph.ExitSubgraph',
      icon: 'pi pi-arrow-up',
      label: t('g.exit_subgraph'),
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
      id: 'Comfy.Subgraph.SetDescription',
      icon: 'pi pi-pencil',
      label: t('g.set_subgraph_description'),
      versionAdded: '1.39.7',
      function: async (metadata?: Record<string, unknown>) => {
        const canvas = canvasStore.getCanvas()
        const subgraph = canvas.subgraph
        if (!subgraph) return

        const extra = (subgraph.extra ??= {}) as Record<string, unknown>
        const currentDescription = (extra.BlueprintDescription as string) ?? ''

        let description: string | null | undefined
        const rawDescription = metadata?.description
        if (rawDescription != null) {
          description =
            typeof rawDescription === 'string'
              ? rawDescription
              : String(rawDescription)
        }
        description ??= await dialogService.prompt({
          title: t('g.description'),
          message: t('subgraphStore.enterDescription'),
          defaultValue: currentDescription
        })
        if (description === null) return

        extra.BlueprintDescription = description.trim() || undefined
        workflowStore.activeWorkflow?.changeTracker?.captureCanvasState()
      }
    },
    {
      id: 'Comfy.Subgraph.SetSearchAliases',
      icon: 'pi pi-search',
      label: t('g.set_subgraph_search_aliases'),
      versionAdded: '1.39.7',
      function: async (metadata?: Record<string, unknown>) => {
        const canvas = canvasStore.getCanvas()
        const subgraph = canvas.subgraph
        if (!subgraph) return

        const parseAliases = (value: unknown): string[] =>
          (Array.isArray(value) ? value.map(String) : String(value).split(','))
            .map((s) => s.trim())
            .filter(Boolean)

        const extra = (subgraph.extra ??= {}) as Record<string, unknown>

        let aliases: string[]
        const rawAliases = metadata?.aliases
        if (rawAliases == null) {
          const input = await dialogService.prompt({
            title: t('subgraphStore.searchAliases'),
            message: t('subgraphStore.enterSearchAliases'),
            defaultValue: parseAliases(extra.BlueprintSearchAliases ?? '').join(
              ', '
            )
          })
          if (input === null) return
          aliases = parseAliases(input)
        } else {
          aliases = parseAliases(rawAliases)
        }

        extra.BlueprintSearchAliases = aliases.length > 0 ? aliases : undefined
        workflowStore.activeWorkflow?.changeTracker?.captureCanvasState()
      }
    },
    {
      id: 'Comfy.Dev.ShowModelSelector',
      icon: 'pi pi-box',
      label: t('g.show_model_selector_dev'),
      versionAdded: '1.26.2',
      category: 'view-controls' as const,
      function: () => {
        const modelSelectorDialog = useModelSelectorDialog()
        modelSelectorDialog.show()
      }
    },
    {
      id: 'Comfy.Manager.CustomNodesManager.ShowLegacyCustomNodesMenu',
      icon: 'pi pi-bars',
      label: t('g.custom_nodes_legacy'),
      versionAdded: '1.16.4',
      function: async () => {
        await useManagerState().openManager({
          legacyCommand: 'Comfy.Manager.CustomNodesManager.ToggleVisibility',
          showToastOnLegacyError: true,
          isLegacyOnly: true
        })
      }
    },
    {
      id: 'Comfy.Manager.ShowLegacyManagerMenu',
      icon: 'mdi mdi-puzzle',
      label: t('g.manager_menu_legacy'),
      versionAdded: '1.16.4',
      function: async () => {
        await useManagerState().openManager({
          showToastOnLegacyError: true,
          isLegacyOnly: true
        })
      }
    },
    {
      id: 'Comfy.Memory.UnloadModels',
      icon: 'mdi mdi-vacuum-outline',
      label: t('g.unload_models'),
      versionAdded: '1.16.4',
      function: async () => {
        if (!useSettingStore().get('Comfy.Memory.AllowManualUnload')) {
          useToastStore().add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('g.commandProhibited', {
              command: 'Comfy.Memory.UnloadModels'
            })
          })
          return
        }
        await api.freeMemory({ freeExecutionCache: false })
      }
    },
    {
      id: 'Comfy.Memory.UnloadModelsAndExecutionCache',
      icon: 'mdi mdi-vacuum-outline',
      label: t('g.unload_models_and_execution_cache'),
      versionAdded: '1.16.4',
      function: async () => {
        if (!useSettingStore().get('Comfy.Memory.AllowManualUnload')) {
          useToastStore().add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('g.commandProhibited', {
              command: 'Comfy.Memory.UnloadModelsAndExecutionCache'
            })
          })
          return
        }
        await api.freeMemory({ freeExecutionCache: true })
      }
    },
    {
      id: 'Comfy.BrowseModelAssets',
      icon: 'pi pi-folder-open',
      label: t('g.experimental_browse_model_assets'),
      versionAdded: '1.28.3',
      function: async () => {
        if (!useSettingStore().get('Comfy.Assets.UseAssetAPI')) {
          const confirmed = await dialogService.confirm({
            title: 'Enable Asset API',
            message:
              'The Asset API is currently disabled. Would you like to enable it?',
            type: 'default'
          })

          if (!confirmed) return

          const settingStore = useSettingStore()
          await settingStore.set('Comfy.Assets.UseAssetAPI', true)
          await workflowService.reloadCurrentWorkflow()
        }
        const assetBrowserDialog = useAssetBrowserDialog()
        await assetBrowserDialog.browse({
          assetType: 'models',
          title: t('sideToolbar.modelLibrary'),
          onAssetSelected: (asset) => {
            const result = createModelNodeFromAsset(asset)
            if (!result.success) {
              toastStore.add({
                severity: 'error',
                summary: t('g.error'),
                detail: t('assetBrowser.failedToCreateNode')
              })
              console.error('Node creation failed:', result.error)
            }
          }
        })
      }
    },
    {
      id: 'Comfy.ToggleAssetAPI',
      icon: 'pi pi-database',
      label: () =>
        `Experimental: ${
          useSettingStore().get('Comfy.Assets.UseAssetAPI')
            ? 'Disable'
            : 'Enable'
        } AssetAPI`,
      function: async () => {
        const settingStore = useSettingStore()
        const current = settingStore.get('Comfy.Assets.UseAssetAPI') ?? false
        await settingStore.set('Comfy.Assets.UseAssetAPI', !current)
        await useWorkflowService().reloadCurrentWorkflow() // ensure changes take effect immediately
      }
    },
    {
      id: 'Comfy.ToggleQPOV2',
      icon: 'pi pi-list',
      label: t('g.toggle_queue_panel_v2'),
      function: toggleQueuePanelV2
    },
    {
      id: 'Comfy.ToggleLinear',
      icon: 'pi pi-database',
      label: t('g.toggle_app_mode'),
      function: (metadata?: Record<string, unknown>) => {
        const source =
          typeof metadata?.source === 'string' ? metadata.source : 'keybind'
        const newMode = !canvasStore.linearMode
        if (newMode) useTelemetry()?.trackEnterLinear({ source })
        canvasStore.linearMode = newMode
      }
    }
  ]

  return commands.map((command) => ({ ...command, source: 'System' }))
}
