import { LinkMarkerShape } from '@comfyorg/litegraph'
import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { colorPalettesSchema } from '@/schemas/colorPaletteSchema'
import { zComfyWorkflow, zNodeId } from '@/schemas/comfyWorkflowSchema'
import { zKeybinding } from '@/schemas/keyBindingSchema'
import { NodeBadgeMode } from '@/types/nodeSource'
import { LinkReleaseTriggerAction } from '@/types/searchBoxTypes'

const zNodeType = z.string()
const zQueueIndex = z.number()
const zPromptId = z.string()
const zResultItem = z.object({
  filename: z.string().optional(),
  subfolder: z.string().optional(),
  type: z.string().optional()
})
export type ResultItem = z.infer<typeof zResultItem>
const zOutputs = z
  .object({
    audio: z.array(zResultItem).optional(),
    images: z.array(zResultItem).optional(),
    video: z.array(zResultItem).optional(),
    animated: z.array(z.boolean()).optional()
  })
  .passthrough()

// WS messages
const zStatusWsMessageStatus = z.object({
  exec_info: z.object({
    queue_remaining: z.number().int()
  })
})

const zStatusWsMessage = z.object({
  status: zStatusWsMessageStatus.nullish(),
  sid: z.string().nullish()
})

const zProgressWsMessage = z.object({
  value: z.number().int(),
  max: z.number().int(),
  prompt_id: zPromptId,
  node: zNodeId
})

const zExecutingWsMessage = z.object({
  node: zNodeId,
  display_node: zNodeId,
  prompt_id: zPromptId
})

const zExecutedWsMessage = zExecutingWsMessage.extend({
  output: zOutputs,
  merge: z.boolean().optional()
})

const zExecutionWsMessageBase = z.object({
  prompt_id: zPromptId,
  timestamp: z.number().int()
})

const zExecutionStartWsMessage = zExecutionWsMessageBase
const zExecutionSuccessWsMessage = zExecutionWsMessageBase
const zExecutionCachedWsMessage = zExecutionWsMessageBase.extend({
  nodes: z.array(zNodeId)
})
const zExecutionInterruptedWsMessage = zExecutionWsMessageBase.extend({
  node_id: zNodeId,
  node_type: zNodeType,
  executed: z.array(zNodeId)
})
const zExecutionErrorWsMessage = zExecutionWsMessageBase.extend({
  node_id: zNodeId,
  node_type: zNodeType,
  executed: z.array(zNodeId),
  exception_message: z.string(),
  exception_type: z.string(),
  traceback: z.array(z.string()),
  current_inputs: z.any(),
  current_outputs: z.any()
})

const zTerminalSize = z.object({
  cols: z.number(),
  row: z.number()
})
const zLogEntry = z.object({
  t: z.string(),
  m: z.string()
})
const zLogsWsMessage = z.object({
  size: zTerminalSize.optional(),
  entries: z.array(zLogEntry)
})
const zLogRawResponse = z.object({
  size: zTerminalSize,
  entries: z.array(zLogEntry)
})

export type StatusWsMessageStatus = z.infer<typeof zStatusWsMessageStatus>
export type StatusWsMessage = z.infer<typeof zStatusWsMessage>
export type ProgressWsMessage = z.infer<typeof zProgressWsMessage>
export type ExecutingWsMessage = z.infer<typeof zExecutingWsMessage>
export type ExecutedWsMessage = z.infer<typeof zExecutedWsMessage>
export type ExecutionStartWsMessage = z.infer<typeof zExecutionStartWsMessage>
export type ExecutionSuccessWsMessage = z.infer<
  typeof zExecutionSuccessWsMessage
>
export type ExecutionCachedWsMessage = z.infer<typeof zExecutionCachedWsMessage>
export type ExecutionInterruptedWsMessage = z.infer<
  typeof zExecutionInterruptedWsMessage
>
export type ExecutionErrorWsMessage = z.infer<typeof zExecutionErrorWsMessage>
export type LogsWsMessage = z.infer<typeof zLogsWsMessage>
// End of ws messages

const zPromptInputItem = z.object({
  inputs: z.record(z.string(), z.any()),
  class_type: zNodeType
})

const zPromptInputs = z.record(zPromptInputItem)

const zExtraPngInfo = z
  .object({
    workflow: zComfyWorkflow
  })
  .passthrough()

const zExtraData = z.object({
  /** extra_pnginfo can be missing is backend execution gets a validation error. */
  extra_pnginfo: zExtraPngInfo.optional(),
  client_id: z.string()
})
const zOutputsToExecute = z.array(zNodeId)

const zExecutionStartMessage = z.tuple([
  z.literal('execution_start'),
  zExecutionStartWsMessage
])

const zExecutionSuccessMessage = z.tuple([
  z.literal('execution_success'),
  zExecutionSuccessWsMessage
])

const zExecutionCachedMessage = z.tuple([
  z.literal('execution_cached'),
  zExecutionCachedWsMessage
])

const zExecutionInterruptedMessage = z.tuple([
  z.literal('execution_interrupted'),
  zExecutionInterruptedWsMessage
])

const zExecutionErrorMessage = z.tuple([
  z.literal('execution_error'),
  zExecutionErrorWsMessage
])

const zStatusMessage = z.union([
  zExecutionStartMessage,
  zExecutionSuccessMessage,
  zExecutionCachedMessage,
  zExecutionInterruptedMessage,
  zExecutionErrorMessage
])

const zStatus = z.object({
  status_str: z.enum(['success', 'error']),
  completed: z.boolean(),
  messages: z.array(zStatusMessage)
})

const zTaskPrompt = z.tuple([
  zQueueIndex,
  zPromptId,
  zPromptInputs,
  zExtraData,
  zOutputsToExecute
])

const zRunningTaskItem = z.object({
  taskType: z.literal('Running'),
  prompt: zTaskPrompt,
  // @Deprecated
  remove: z.object({
    name: z.literal('Cancel'),
    cb: z.function()
  })
})

const zPendingTaskItem = z.object({
  taskType: z.literal('Pending'),
  prompt: zTaskPrompt
})

const zTaskOutput = z.record(zNodeId, zOutputs)

const zNodeOutputsMeta = z.object({
  node_id: zNodeId,
  display_node: zNodeId,
  prompt_id: zPromptId.optional(),
  read_node_id: zNodeId.optional()
})

const zTaskMeta = z.record(zNodeId, zNodeOutputsMeta)

const zHistoryTaskItem = z.object({
  taskType: z.literal('History'),
  prompt: zTaskPrompt,
  status: zStatus.optional(),
  outputs: zTaskOutput,
  meta: zTaskMeta.optional()
})

const zTaskItem = z.union([
  zRunningTaskItem,
  zPendingTaskItem,
  zHistoryTaskItem
])

const zTaskType = z.union([
  z.literal('Running'),
  z.literal('Pending'),
  z.literal('History')
])

export type TaskType = z.infer<typeof zTaskType>
export type TaskPrompt = z.infer<typeof zTaskPrompt>
export type TaskStatus = z.infer<typeof zStatus>
export type TaskOutput = z.infer<typeof zTaskOutput>

// `/queue`
export type RunningTaskItem = z.infer<typeof zRunningTaskItem>
export type PendingTaskItem = z.infer<typeof zPendingTaskItem>
// `/history`
export type HistoryTaskItem = z.infer<typeof zHistoryTaskItem>
export type TaskItem = z.infer<typeof zTaskItem>

export function validateTaskItem(taskItem: unknown) {
  const result = zTaskItem.safeParse(taskItem)
  if (!result.success) {
    const zodError = fromZodError(result.error)
    // TODO accept a callback to report error.
    console.warn(
      `Invalid TaskItem: ${JSON.stringify(taskItem)}\n${zodError.message}`
    )
  }
  return result
}

const zEmbeddingsResponse = z.array(z.string())
const zExtensionsResponse = z.array(z.string())
const zError = z.object({
  type: z.string(),
  message: z.string(),
  details: z.string(),
  extra_info: z
    .object({
      input_name: z.string().optional()
    })
    .passthrough()
    .optional()
})
const zNodeError = z.object({
  errors: z.array(zError),
  class_type: z.string(),
  dependent_outputs: z.array(z.any())
})
const zPromptResponse = z.object({
  node_errors: z.record(zNodeId, zNodeError).optional(),
  prompt_id: z.string().optional(),
  exec_info: z
    .object({
      queue_remaining: z.number().optional()
    })
    .optional(),
  error: z.union([z.string(), zError])
})

const zDeviceStats = z.object({
  name: z.string(),
  type: z.string(),
  index: z.number(),
  vram_total: z.number(),
  vram_free: z.number(),
  torch_vram_total: z.number(),
  torch_vram_free: z.number()
})

export const zSystemStats = z.object({
  system: z.object({
    os: z.string(),
    python_version: z.string(),
    embedded_python: z.boolean(),
    comfyui_version: z.string(),
    pytorch_version: z.string(),
    argv: z.array(z.string()),
    ram_total: z.number(),
    ram_free: z.number()
  }),
  devices: z.array(zDeviceStats)
})
const zUser = z.object({
  storage: z.enum(['server']),
  // `migrated` is only available in single-user mode.
  migrated: z.boolean().optional(),
  // `users` is only available in multi-user server mode.
  users: z.record(z.string(), z.string()).optional()
})
const zUserData = z.array(z.array(z.string(), z.string()))
const zUserDataFullInfo = z.object({
  path: z.string(),
  size: z.number(),
  modified: z.number()
})
const zBookmarkCustomization = z.object({
  icon: z.string().optional(),
  color: z.string().optional()
})
export type BookmarkCustomization = z.infer<typeof zBookmarkCustomization>

const zLinkReleaseTriggerAction = z.enum(
  Object.values(LinkReleaseTriggerAction) as [string, ...string[]]
)

const zNodeBadgeMode = z.enum(
  Object.values(NodeBadgeMode) as [string, ...string[]]
)

const zSettings = z.record(z.any()).and(
  z
    .object({
      'Comfy.ColorPalette': z.string(),
      'Comfy.CustomColorPalettes': colorPalettesSchema,
      'Comfy.ConfirmClear': z.boolean(),
      'Comfy.DevMode': z.boolean(),
      'Comfy.Workflow.ShowMissingNodesWarning': z.boolean(),
      'Comfy.Workflow.ShowMissingModelsWarning': z.boolean(),
      'Comfy.DisableFloatRounding': z.boolean(),
      'Comfy.DisableSliders': z.boolean(),
      'Comfy.DOMClippingEnabled': z.boolean(),
      'Comfy.EditAttention.Delta': z.number(),
      'Comfy.EnableTooltips': z.boolean(),
      'Comfy.EnableWorkflowViewRestore': z.boolean(),
      'Comfy.FloatRoundingPrecision': z.number(),
      'Comfy.Graph.CanvasInfo': z.boolean(),
      'Comfy.Graph.CanvasMenu': z.boolean(),
      'Comfy.Graph.CtrlShiftZoom': z.boolean(),
      'Comfy.Graph.LinkMarkers': z.nativeEnum(LinkMarkerShape),
      'Comfy.Graph.ZoomSpeed': z.number(),
      'Comfy.Group.DoubleClickTitleToEdit': z.boolean(),
      'Comfy.GroupSelectedNodes.Padding': z.number(),
      'Comfy.InvertMenuScrolling': z.boolean(),
      'Comfy.Locale': z.string(),
      'Comfy.Logging.Enabled': z.boolean(),
      'Comfy.NodeLibrary.Bookmarks': z.array(z.string()),
      'Comfy.NodeLibrary.Bookmarks.V2': z.array(z.string()),
      'Comfy.NodeLibrary.BookmarksCustomization': z.record(
        z.string(),
        zBookmarkCustomization
      ),
      'Comfy.LinkRelease.Action': zLinkReleaseTriggerAction,
      'Comfy.LinkRelease.ActionShift': zLinkReleaseTriggerAction,
      'Comfy.ModelLibrary.AutoLoadAll': z.boolean(),
      'Comfy.ModelLibrary.NameFormat': z.enum(['filename', 'title']),
      'Comfy.NodeSearchBoxImpl.NodePreview': z.boolean(),
      'Comfy.NodeSearchBoxImpl': z.enum(['default', 'simple']),
      'Comfy.NodeSearchBoxImpl.ShowCategory': z.boolean(),
      'Comfy.NodeSearchBoxImpl.ShowIdName': z.boolean(),
      'Comfy.NodeSearchBoxImpl.ShowNodeFrequency': z.boolean(),
      'Comfy.NodeSuggestions.number': z.number(),
      'Comfy.Node.BypassAllLinksOnDelete': z.boolean(),
      'Comfy.Node.Opacity': z.number(),
      'Comfy.Node.MiddleClickRerouteNode': z.boolean(),
      'Comfy.Node.ShowDeprecated': z.boolean(),
      'Comfy.Node.ShowExperimental': z.boolean(),
      'Comfy.Pointer.ClickBufferTime': z.number(),
      'Comfy.Pointer.ClickDrift': z.number(),
      'Comfy.Pointer.DoubleClickTime': z.number(),
      'Comfy.PreviewFormat': z.string(),
      'Comfy.PromptFilename': z.boolean(),
      'Comfy.Sidebar.Location': z.enum(['left', 'right']),
      'Comfy.Sidebar.Size': z.enum(['small', 'normal']),
      'Comfy.SwitchUser': z.any(),
      'Comfy.SnapToGrid.GridSize': z.number(),
      'Comfy.TextareaWidget.FontSize': z.number(),
      'Comfy.TextareaWidget.Spellcheck': z.boolean(),
      'Comfy.UseNewMenu': z.enum(['Disabled', 'Top', 'Bottom']),
      'Comfy.TreeExplorer.ItemPadding': z.number(),
      'Comfy.Validation.Workflows': z.boolean(),
      'Comfy.Validation.NodeDefs': z.boolean(),
      'Comfy.Workflow.SortNodeIdOnSave': z.boolean(),
      'Comfy.Queue.ImageFit': z.enum(['contain', 'cover']),
      'Comfy.Workflow.WorkflowTabsPosition': z.enum([
        'Sidebar',
        'Topbar',
        'Topbar (2nd-row)'
      ]),
      'Comfy.Node.DoubleClickTitleToEdit': z.boolean(),
      'Comfy.WidgetControlMode': z.enum(['before', 'after']),
      'Comfy.Window.UnloadConfirmation': z.boolean(),
      'Comfy.NodeBadge.NodeSourceBadgeMode': zNodeBadgeMode,
      'Comfy.NodeBadge.NodeIdBadgeMode': zNodeBadgeMode,
      'Comfy.NodeBadge.NodeLifeCycleBadgeMode': zNodeBadgeMode,
      'Comfy.QueueButton.BatchCountLimit': z.number(),
      'Comfy.Queue.MaxHistoryItems': z.number(),
      'Comfy.Keybinding.UnsetBindings': z.array(zKeybinding),
      'Comfy.Keybinding.NewBindings': z.array(zKeybinding),
      'Comfy.Extension.Disabled': z.array(z.string()),
      'Comfy.Settings.ExtensionPanel': z.boolean(),
      'Comfy.LinkRenderMode': z.number(),
      'Comfy.Node.AutoSnapLinkToSlot': z.boolean(),
      'Comfy.Node.SnapHighlightsNode': z.boolean(),
      'Comfy.Server.ServerConfigValues': z.record(z.string(), z.any()),
      'Comfy.Server.LaunchArgs': z.record(z.string(), z.string()),
      'LiteGraph.Canvas.MaximumFps': z.number(),
      'Comfy.Workflow.ConfirmDelete': z.boolean(),
      'Comfy.RerouteBeta': z.boolean(),
      'LiteGraph.Canvas.LowQualityRenderingZoomThreshold': z.number(),
      'Comfy.Canvas.SelectionToolbox': z.boolean()
    })
    .optional()
)

export type EmbeddingsResponse = z.infer<typeof zEmbeddingsResponse>
export type ExtensionsResponse = z.infer<typeof zExtensionsResponse>
export type PromptResponse = z.infer<typeof zPromptResponse>
export type NodeError = z.infer<typeof zNodeError>
export type Settings = z.infer<typeof zSettings>
export type DeviceStats = z.infer<typeof zDeviceStats>
export type SystemStats = z.infer<typeof zSystemStats>
export type User = z.infer<typeof zUser>
export type UserData = z.infer<typeof zUserData>
export type UserDataFullInfo = z.infer<typeof zUserDataFullInfo>
export type TerminalSize = z.infer<typeof zTerminalSize>
export type LogEntry = z.infer<typeof zLogEntry>
export type LogsRawResponse = z.infer<typeof zLogRawResponse>
